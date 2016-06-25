
# Copyright (c) 2016 Structured Data, LLC
# 
# Permission is hereby granted, free of charge, to any person obtaining a copy
# of this software and associated documentation files (the "Software"), to 
# deal in the Software without restriction, including without limitation the 
# rights to use, copy, modify, merge, publish, distribute, sublicense, and/or 
# sell copies of the Software, and to permit persons to whom the Software is 
# furnished to do so, subject to the following conditions:
#
# The above copyright notice and this permission notice shall be included in 
# all copies or substantial portions of the Software.
#
# THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
# IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY, 
# FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
# AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER 
# LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING 
# FROM, OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS
# IN THE SOFTWARE.

(function(){

#-----------------------------------------------------------------------------
# requried libs (if any)
#-----------------------------------------------------------------------------

# jsClientLib is automatically loaded so no longer needs to be 
# loaded here -- but we should still have the error message somewhere

#library.loaded <- suppressWarnings( require( jsClientLib, quietly=T ));
#
#if( !library.loaded ){
#	stop( "	
#
#The jsClientLib library is not available.  Many functions in the shell
#depend on this library, and will not work as expected.  You can download
#the library from the git repo:
#
#https://github.com/sdllc/jsclientlib
#
#" );
#
#}

#-----------------------------------------------------------------------------
# set options (user can override)
#-----------------------------------------------------------------------------

options( 
	browser=jsClientLib:::browser, 
	pager=jsClientLib:::pager,
	help_type='html'
);

#-----------------------------------------------------------------------------
# change some functions for the js shell.  FIXME: user configurable 
#-----------------------------------------------------------------------------

override.binding <- function( name, func, ns, assign.in.namespace=T ){
	
	if( exists( name ) ){ 
		package <- paste0( "package:", ns );
		
		unlockBinding( name, as.environment(package)); 
		assign( name, func, as.environment(package));

		if( assign.in.namespace ){
			ns <- asNamespace( ns );
			if (bindingIsLocked(name, ns)) {
				unlockBinding(name, ns)
				assign(name, func, envir = ns, inherits = FALSE)
				w <- options("warn")
				on.exit(options(w))
				options(warn = -1)
				lockBinding(name, ns)
			}
			else assign(name, func, envir = ns, inherits = FALSE);
		}
		
		lockBinding( name, as.environment(package)); 
	}
	else {
		# can't assign to a locked environment if there is no existing binding?
		# assign( name, func, .GlobalEnv);
	}
}

#-----------------------------------------------------------------------------
# override quit() and q() so we can close properly
#-----------------------------------------------------------------------------

override.binding( "quit", jsClientLib:::quit, "base" );
override.binding( "q", jsClientLib:::quit, "base" );


#-----------------------------------------------------------------------------
# we override install.packages and chooseCRANmirror to use the local
# mechanisms, but only when they are called with 0 arguments.  the 
# arguments are mapped to the replacement functions so that calltips 
# work as expected.
#-----------------------------------------------------------------------------

subvert.function <- function( base.name, ns ){
	package.name <- paste0( "package:", ns );
	original.function <- get( base.name, envir=as.environment( package.name ));
	f <- function(){
		if( nargs() == 0 ){
			jsClientLib:::.js.client.callback( "system", list( cmd=base.name, args=list()));
		}
		else {
			arglist <- as.list( match.call())[-1];
			do.call( original.function, arglist, envir=parent.env(environment()));
		}
	}
	formals(f) <- formals( original.function );
	override.binding( base.name, f, ns );
}
subvert.function( "install.packages", "utils" );
subvert.function( "chooseCRANmirror", "utils" );

#-----------------------------------------------------------------------------
# separately override history.  this won't actually overwrite the 
# utils::history binding because it's locked, but it does put it into
# that package's namespace
#-----------------------------------------------------------------------------

override.binding( "history", 
	function(max.show = 25, reverse = FALSE, pattern, ...){
		
		text <- jsClientLib:::.js.client.callback.sync( list( command="history" ));
		lines <- strsplit( text, "\n", fixed=T )[[1L]];
		
		if( !missing( pattern )){
			
			lines = lines[grep( pattern, lines, ... )];
			
			# from ?history: 
			#
			# When supplied, only unique matching lines are shown.
			# 
			
			lines = lines[ !duplicated(lines)];
		}
		
		lines <- rev(lines);
		lines <- lines[1:min(length(lines),max.show)];
		if( !reverse ) lines = rev(lines);
		
		cat( "\n" );
		cat( paste(" ", lines), sep="\n" );
		cat( "\n" );
		
	}, "utils");

#------------------------------------------------------------------------------
# autocomplete
#------------------------------------------------------------------------------

#--------------------------------------------------------
# this is a monkeypatch for the existing R autocomplete 
# functionality. we are making two changes: (1) for 
# functions, store the signagure for use as a call tip.  
# (2) for functions within environments, resolve and get 
# parameters.
#--------------------------------------------------------
rc.options( custom.completer = function (.CompletionEnv) 
{
	.fqFunc <- function (line, cursor=-1) 
	{
		localBreakRE <- "[^\\.\\w\\$\\@\\:]";

		if( cursor == -1 ){ cursor = nchar(line); }

	    parens <- sapply(c("(", ")"), function(s) gregexpr(s, substr(line, 
		1L, cursor), fixed = TRUE)[[1L]], simplify = FALSE)
	    parens <- lapply(parens, function(x) x[x > 0])
	       
	    
	    temp <- data.frame(i = c(parens[["("]], parens[[")"]]), c = rep(c(1, 
		-1), lengths(parens)))
	    if (nrow(temp) == 0) 
		return(character())
		
	    temp <- temp[order(-temp$i), , drop = FALSE]
	    wp <- which(cumsum(temp$c) > 0)

	    if (length(wp)) {
		index <- temp$i[wp[1L]]
		prefix <- substr(line, 1L, index - 1L)
		suffix <- substr(line, index + 1L, cursor + 1L)
		
		if ((length(grep("=", suffix, fixed = TRUE)) == 0L) && 
		    (length(grep(",", suffix, fixed = TRUE)) == 0L)) 
		    utils:::setIsFirstArg(TRUE)
		if ((length(grep("=", suffix, fixed = TRUE))) && (length(grep(",", 
		    substr(suffix, utils:::tail.default(gregexpr("=", suffix, 
			fixed = TRUE)[[1L]], 1L), 1000000L), fixed = TRUE)) == 
		    0L)) {
		    return(character())
		}
		else {
		    possible <- suppressWarnings(strsplit(prefix, localBreakRE, 
			perl = TRUE))[[1L]]
		    possible <- possible[nzchar(possible)]
		    if (length(possible)) 
			return(utils:::tail.default(possible, 1))
		    else return(character())
		}
	    }
	    else {
		return(character())
	    }
	}

	.fqFunctionArgs <- function (fun, text, S3methods = utils:::.CompletionEnv$settings[["S3"]], 
	    S4methods = FALSE, add.args = rc.getOption("funarg.suffix")) 
	{
		.tip <- F;
		.resolveObject <- function( name ){
			p <- environment();
			name <- sub( ",.*$", "", name );
			n <- unlist( strsplit( name, "[^\\w\\.]", F, T ));
			 while( length( n ) > 1 ){
				if( !exists( n[1], where=p )) return( NULL );
				p <- get( n[1], envir=p );
				n <- n[-1];
			}
			if( !exists( n[1], where=p )) return( NULL );
			list( name=n[1], fun=get( n[1], envir=p ));
		}
	
		.function.signature <- function(fun){
			x <- capture.output( args(fun));
			paste(trimws(x[-length(x)]), collapse=" ");
		}
	
		.fqArgNames <- function (fname, use.arg.db = utils:::.CompletionEnv$settings[["argdb"]]) 
		{
			funlist <- .resolveObject( fname );
			fun <- funlist$fun;
			if( !is.null(fun) && is.function(fun )) { 
				if( !.tip ){
					env <- utils:::.CompletionEnv;
					env$function.signature <- sub( '^function ', paste0( funlist$name, ' ' ), .function.signature(fun));
					.tip <<- T;
				}
				return(names( formals( fun ))); 
			}
			return( character());
		};

		if (length(fun) < 1L || any(fun == "")) 
			return(character())
		    specialFunArgs <- utils:::specialFunctionArgs(fun, text)
		if (S3methods && exists(fun, mode = "function")) 
			fun <- c(fun, tryCatch(methods(fun), warning = function(w) {
			}, error = function(e) {
			}))
		if (S4methods) 
			warning("cannot handle S4 methods yet")
		allArgs <- unique(unlist(lapply(fun, .fqArgNames)))
		ans <- utils:::findMatches(sprintf("^%s", utils:::makeRegexpSafe(text)), 
			allArgs)
		if (length(ans) && !is.null(add.args)) 
			ans <- sprintf("%s%s", ans, add.args)
		c(specialFunArgs, ans)
	}

	.CompletionEnv[["function.signature"]] <- "";
	.CompletionEnv[["in.quotes"]] <- F;

	    text <- .CompletionEnv[["token"]]
	    if (utils:::isInsideQuotes()) {
			.CompletionEnv[["in.quotes"]] <- T;
			if (.CompletionEnv$settings[["quotes"]]) {
				fullToken <- utils:::.guessTokenFromLine(update = FALSE)
				probablyHelp <- (fullToken$start >= 2L && ((substr(.CompletionEnv[["linebuffer"]], 
					fullToken$start - 1L, fullToken$start - 1L)) == 
					"?"))
				if (probablyHelp) {
					fullToken$prefix <- utils:::.guessTokenFromLine(end = fullToken$start - 
					2, update = FALSE)$token
				}
				probablyName <- ((fullToken$start > 2L && ((substr(.CompletionEnv[["linebuffer"]], 
					fullToken$start - 1L, fullToken$start - 1L)) == 
					"$")) || (fullToken$start > 3L && ((substr(.CompletionEnv[["linebuffer"]], 
					fullToken$start - 2L, fullToken$start - 1L)) == 
					"[[")))
				probablyNamespace <- (fullToken$start > 3L && ((substr(.CompletionEnv[["linebuffer"]], 
					fullToken$start - 2L, fullToken$start - 1L)) %in% 
					c("::")))
				probablySpecial <- probablyHelp || probablyName || 
					probablyNamespace

				tentativeCompletions <- if (probablyHelp) {
					substring(utils:::helpCompletions(fullToken$prefix, fullToken$token), 
					2L + nchar(fullToken$prefix), 1000L)
				}
				else if (!probablySpecial) 
					utils:::fileCompletions(fullToken$token)
				utils:::.setFileComp(FALSE)
				.CompletionEnv[["comps"]] <- substring(tentativeCompletions, 
					1L + nchar(fullToken$token) - nchar(text), 1000L)
			}
			else {
				.CompletionEnv[["comps"]] <- character()
				utils:::.setFileComp(TRUE)
			}
	    }
	    else {
			utils:::.setFileComp(FALSE)
			utils:::setIsFirstArg(FALSE)
			guessedFunction <- if (.CompletionEnv$settings[["args"]]) 
				.fqFunc(.CompletionEnv[["linebuffer"]], .CompletionEnv[["start"]])
			else ""
			
			.CompletionEnv[["fguess"]] <- guessedFunction
			fargComps <- .fqFunctionArgs(guessedFunction, text)
			
			if (utils:::getIsFirstArg() && length(guessedFunction) && guessedFunction %in% 
				c("library", "require", "data")) {
				.CompletionEnv[["comps"]] <- fargComps
				return()
			}
			lastArithOp <- utils:::tail.default(gregexpr("[\"'^/*+-]", text)[[1L]], 
				1)
			if (haveArithOp <- (lastArithOp > 0)) {
				prefix <- substr(text, 1L, lastArithOp)
				text <- substr(text, lastArithOp + 1L, 1000000L)
			}
			spl <- utils:::specialOpLocs(text)
			comps <- if (length(spl)) 
				utils:::specialCompletions(text, spl)
			else {
				appendFunctionSuffix <- !any(guessedFunction %in% 
				c("help", "args", "formals", "example", "do.call", 
				"environment", "page", "apply", "sapply", "lapply", 
				"tapply", "mapply", "methods", "fix", "edit"))
				utils:::normalCompletions(text, check.mode = appendFunctionSuffix)
			}
			if (haveArithOp && length(comps)) {
				comps <- paste0(prefix, comps)
			}
			comps <- c(fargComps, comps)
			.CompletionEnv[["comps"]] <- comps
	    }
});


})();

