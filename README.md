ConstructR
==========

Electron-based R shell.

Build
=====

Build on Linux
--------------

### Prerequisites ###

 * nodejs and npm

 * R

   Either your distribution's R package or R built from source. 
   If you build from source, make sure to use the configure option 
   `--enable-R-shlib` to build shared libraries.

 * jsclientlib (R library)

   Available from https://github.com/sdllc/jsclientlib.  You can
   install this using gulp (in the next section). 
  
### Download, Build and Install ###

```sh
# download
git clone https://github.com/sdllc/constructr.git

# install packages
cd constructr
npm install

# install modules and build
node_modules/.bin/gulp

# (OPTIONAL) if you need to install the `jsclientlib` library
node_modules/.bin/gulp jsclientlib

# now run
node_modules/.bin/electron app/main.js

# alternatively, run with livereload:
# node_modules/.bin/gulp watch
```

