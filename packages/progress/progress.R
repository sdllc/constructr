
(function(){

#-----------------------------------------------------------------------------
# replace win progress bar with an inline progress bar.  there's a slight
# difference in that these functions might not exist on linux.
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
}

override.binding( "winProgressBar", jsClientLib::js.client.progress.bar, "utils");
override.binding( "setWinProgressBar", jsClientLib::js.client.set.progress.bar, "utils");
override.binding( "getWinProgressBar", jsClientLib::js.client.get.progress.bar, "utils");

# optionally this one as well

#override.binding( "txtProgressBar", jsClientLib::js.client.progress.bar, "utils");
#override.binding( "setTxtProgressBar", jsClientLib::js.client.set.progress.bar, "utils");
#override.binding( "getTxtProgressBar", jsClientLib::js.client.get.progress.bar, "utils");

})();
