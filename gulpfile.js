
'use strict';

var gulp = require('gulp');
var run = require('gulp-run');
var livereload = require('gulp-livereload');
var del = require('del');
var source = require('vinyl-source-stream');
var buffer = require('vinyl-buffer');
var assign = require('lodash.assign');
var gutil = require('gulp-util');
var sourcemaps = require('gulp-sourcemaps');
var gulpif = require('gulp-if');
var uglify = require('gulp-uglify');
var addsrc = require('gulp-add-src');
var concat = require('gulp-concat');
var postcss = require('gulp-postcss');
var htmlmin = require('gulp-htmlmin');
var cssnano = require('gulp-cssnano');
var rename = require("gulp-rename");
var webpack = require('webpack-stream');
var path = require('path');

/** flag for watching: controls some compilation features */
var watching = false;
var production = false;

var target = "app";

gulp.task('run', function() {
  return run(`electron ${target}/main.js`).exec()
    .pipe( gulp.dest( 'output' ));
});

gulp.task('reload', function () {
	console.info( "(*)");
	return livereload();
})

var components_source = [
	'components/**/*.html'	
];

var polymer_files = [
	'bower_components/polymer/polymer.html',
	'bower_components/polymer/polymer-micro.html',
	'bower_components/polymer/polymer-mini.html'
];

var html_source = [ 'html/**/*.html' ];
var core_source = [ 'core/**/*.js' ];
var plugin_source = [ 'plugin/**/*.*' ];

const r_source = [ 'R/**/*' ];
const main_source = [ 'main/main.js' ];
const theme_source = ['theme/**/*.css'];
const data_source = ['data/**/*'];
const ext_source = [ 'ext/**/*' ];

const packages_source = [ 'packages/**/*' ];

// only process the main css file; it must include (@import) any
// required components.  FIXME: use topleve/subdirectories?
var style_source = [ 'postcss/main.css' ];

gulp.task('plugin', function(){
	return gulp.src( plugin_source )
    .pipe( gulp.dest( path.join( target, 'plugin' )))
		.pipe( gulpif(watching, livereload()));
});

gulp.task('R', function(){
    return gulp.src( r_source )
        .pipe( gulp.dest( target ))
        .pipe( gulpif(watching, livereload()));
});

gulp.task('main', function(){
    return gulp.src(main_source)
        .pipe( gulp.dest( target ))
        .pipe( gulpif(watching, livereload()));
});

gulp.task('packages', function(){
		return gulp.src( packages_source )
        .pipe( gulp.dest( path.join( target, 'packages' )))
        .pipe( gulpif(watching, livereload()));
});

gulp.task('core', function(){
	return gulp.src( core_source )
		.pipe(webpack( require('./webpack.config.js') ))
		.pipe(gulp.dest(''))
    //.pipe( gulp.dest( path.join( target, 'core' )))
		.pipe( gulpif(watching, livereload()));
});

gulp.task('polymer', function(){
    return gulp.src(polymer_files)
        .pipe( gulp.dest( target ))
        .pipe( gulpif(watching, livereload()));
});

const codemirror_source = [ 'bower_components/codemirror/**/*' ];
gulp.task('codemirror', function(){
    return gulp.src( codemirror_source )
      .pipe( gulp.dest( path.join( target, 'codemirror')))
      .pipe( gulpif(watching, livereload()));
});

// FIXME: we need to subset only required files; at a minimum,
// remove non-minified js and css.  NOTE: there's also a build
// tool which might be useful to cut out extra stuff (TODO)

const handsontable_source = [ 'bower_components/handsontable/dist/*full.min*' ];
gulp.task('handsontable', function(){
    return gulp.src( handsontable_source )
      .pipe( gulp.dest( path.join( target, "packages", "table", "handsontable" )))
      .pipe( gulpif(watching, livereload()));
});

/** copy external/3d party resources */
gulp.task('ext', function(){
    return gulp.src( ext_source )
      .pipe( gulp.dest( target))
      .pipe( gulpif(watching, livereload()));
});

gulp.task('components', function(){
	return gulp.src(components_source)
		.pipe( concat( 'components.html' ))
		.pipe(htmlmin({
			collapseWhitespace: true,
			removeComments: true,
			minifyJS: {
				minifier: function( text, options ){
					var uglify = require( "uglify-js" );
					return uglify.minify(text, options).code;
				}
			},
			minifyCSS: true
		}))
    .pipe( gulp.dest( target ))
    .pipe( gulpif(watching, livereload()));
});

gulp.task('data', function () {
  gulp.src( data_source )
    .pipe( gulp.dest( target + '/data' ))
    .pipe( gulpif(watching, livereload()));
});

gulp.task('themes', function () {
  gulp.src( theme_source )
    .pipe( gulp.dest( target + '/theme' ))
    .pipe( gulpif(watching, livereload()));
});

gulp.task('styles', function () {
  gulp.src(style_source)
    .pipe( postcss([
      require('postcss-import')(),
//      require('postcss-mixins')(),
//      require('postcss-simple-vars')(),
//      require('postcss-nested')(),
//      require('autoprefixer')(),
      ]))
    .pipe(cssnano())
    .pipe(rename("core.css"))
    .pipe( gulp.dest(target))
	 .pipe( gulpif( watching, livereload()));
});

gulp.task('html', function(){
	gulp.src(html_source)
		.pipe( gulp.dest( function( file ){
      
      // we have tags (comments) marking blocks that can be removed
      if( !watching ){
        //console.info( "scrubbing html" );
        var contents = file.contents.toString();
        contents = contents.replace( /<\!-- watching -->[\s\S]*<\!-- \/watching -->/, "" );
        file.contents = Buffer.from( contents, "utf8" );
      }
      
      return target; 
    }))
	 .pipe( gulpif( watching, livereload()));
})

var relativize = function( obj ){
	var rex = new RegExp( "(?:^|/)" + target + "(?:/|$)");
	Object.keys( obj ).forEach( function( key ){
		var t = typeof( obj[key] );
		if( t === "string" ){
			var m = obj[key].match( rex )
			if( m ){
				var match = m[0];
				var repl = "";
				if( match.startsWith('/') && match.endsWith( '/' )) repl = "/";
				obj[key] = obj[key].replace( m[0], repl );
			}
		}
		else if( t === "object" ){
			relativize( obj[key] );
		}
	});
}

gulp.task('package.json', function(){
  gulp.src( 'package.json' )
    .pipe( gulp.dest( function( file ){
      var data = JSON.parse( file.contents.toString());
      delete data.devDependencies;
      delete data.scripts;
      delete data.build;
	  relativize( data );
      data['README-package.json'] = "This is a generated file for distribution.  Do not edit!";
      file.contents = Buffer.from( JSON.stringify( data, undefined, 3 ), "utf8" );
      return( target );
    }));
});

gulp.task( 'watch-flags', function(){
  console.info( "setting watch flags" );
  watching = true;  
});

gulp.task('watch', ['watch-flags', 'default'], function () {
	livereload.listen();
	gulp.watch( html_source, ['html']);
	gulp.watch( style_source, ['styles']);
	gulp.watch( core_source, ['core']);
	gulp.watch( plugin_source, ['plugin']);
	gulp.watch( main_source, ['main']);
	gulp.watch( components_source, ['components']);
	gulp.watch( theme_source, ['themes']);
	gulp.watch( data_source, ['data']);
	gulp.watch( r_source, ['R']);
	gulp.watch( packages_source, ['packages']);
	gulp.watch( ext_source, ['ext']);

  // third party libs don't need to be watched
    
	// gulp.watch( polymer_files, ['polymer']);
	// gulp.watch( codemirror_source, ['codemirror']);

	return run(`electron ./${target}/main.js`).exec();
	 
});

gulp.task('default', ['ext', 'handsontable', 'codemirror', 'package.json', 'data', 'html', 'styles', 'main', 'core', 'polymer', 'components', 'themes', 'R', 'plugin', 'packages' ]);
