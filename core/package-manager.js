
"use strict";

const path = require( 'path' );
const fs = require( 'fs' );

const X = eval( 'require' ); // !webpack

window.fs = fs;

var PackageManager = function(){

    /** loaded packages, by name */
    this.packages = {};

    /** pending packages (missing deps) */
    this.pending = [];

    /** hold on to spec */
    this.spec = {};

    /**
     * list packages, concatenate name
     */
    this.list_packages = function( package_dir ){
        console.info( "LP", package_dir );
        return new Promise( function( resolve, reject ){
            fs.readdir( package_dir, function(err, files){
                resolve(files.map( function( file ){
                    return path.join( package_dir, file );
                }));
            });
        });
    };

    /**
     * load packages, recursively, from list.
     * added dependencies.  todo: versioned deps
     */
    this.load_packages = function( list, core, opts ){
        
        let self = this;

        opts = opts || {};
        if( !Array.isArray( list )) list = [list];

        let default_settings = function( prefs ){
            for( let key in prefs ){
                if( typeof core.Settings[key] === "undefined" 
                    && typeof prefs[key].default !== "undefined" ){
                    core.Settings[key] = prefs[key].default;
                }
            }
        };

        let init_package = function( pkg ){

            console.info( "Installing package", pkg.name );

            // if this package has options, with defaults, 
            // enforce defaults.
            if( pkg.preferences ) default_settings( pkg.preferences );
            if( pkg.preferenceGroups ){
                for( let group in pkg.preferenceGroups ){
                    default_settings( pkg.preferenceGroups[group] );
                }
            }

            // ok, load and call init
            self.packages[ pkg.name ] = pkg.module;
            self.spec[ pkg.name ] = pkg;

            // can use a different method name (?)
            var func = "init";
            if( pkg.init ) func = pkg.init; 

            // doesn't actually have to export an init method
            // also: init doesn't necessarily have to return 
            // a thenable 
            if( pkg.module[func] ){
                let rslt = pkg.module[func].call( this, core);
                return rslt ? rslt : Promise.resolve();
            }
            else return Promise.resolve();

        };

        return new Promise( function( resolve, reject ){
            if( list.length ){
                let elt = list.shift();
                self.load( elt ).then( function( pkg, err ){
                    if( pkg ){

                        // don't reload if we have already loaded
                        // (UPDATE: argument)
                        if( !opts.allow_override && self.packages[ pkg.name ]) return Promise.resolve();

                        // check deps
                        if( pkg.packageDependencies ){
                            let deps = Array.isArray( pkg.packageDependencies ) ? 
                                pkg.packageDependencies : Object.keys( pkg.packageDependencies );
                            if( deps.some( function( dep ){
                                return !self.packages[ dep ];
                            })){
                                self.pending.push( pkg );
                                return Promise.resolve();
                            }
                        }

                        return init_package( pkg );

                    }
                    return Promise.resolve();
                }).then( function(){
                    return self.load_packages( list, core, opts );
                }).then( function(){
                    resolve();
                });
            }
            else {

                if( self.pending.length ){
                    for( let i = 0; i< self.pending.length; i++ ){
                        let pkg = self.pending[i];
                        let deps = Array.isArray( pkg.packageDependencies ) ? 
                            pkg.packageDependencies : Object.keys( pkg.packageDependencies );
                        if( deps.every( function( dep ){
                            return !!self.packages[ dep ];
                        })){
                            self.pending.splice( i, 1 );
                            init_package( pkg ).then( function(){
                                return self.load_packages( list, core, opts );
                            }).then( function(){
                                resolve();
                            });
                            return;
                        }
                    }
                    if( self.pending.length ){
                        let unresolvable = self.pending.map( function( pkg ){
                            return pkg.name;
                        });
                        console.info( "Some packages have unresolvable dependencies:" );
                        self.pending.map( function( pkg ){
                            console.info( pkg.name + ":", pkg.packageDependencies ); 
                        });
                    }
                }
                resolve();  

            } 
        });
    };

    /**
     * load a pkg 
     */
    this.load = function(dir){
        return new Promise( function( resolve, reject ){

            // check for a pkg file
            var package_file = path.join( dir, "package.json" );
            fs.readFile( package_file, { encoding: "utf8" }, (err, contents) => {
                if (err){
                    resolve( false, err );
                    return;
                }
                try {
                    var spec = JSON.parse( contents );
                    if( !spec.main ) throw( "package main not found" );
                    if( !spec.name ) throw( "package name not found" );
                    console.info( "Loading package", spec.name);
                    spec.module = X(path.join( dir, spec.main ));
                    resolve(spec);
                }
                catch( err ){
                    console.error( err );
                    resolve( false, err );
                }
            });

        });
    };

};

module.exports = new PackageManager();
