var gulp = require('gulp'),
    pkg = require('./package.json');

var browserify = require('browserify'),
    connect = require('gulp-connect'),
    compress = require('gulp-yuicompressor'),
    // del = require('del'),
    karma = require('karma').server,
    mocha = require('gulp-mocha'),
    mochaPhantomJS = require('gulp-mocha-phantomjs'),
    rename = require('gulp-rename'),
    squash = require('gulp-remove-empty-lines'),
    strip = require('gulp-strip-comments'),
    through2 = require('through2'),
    util = require('gulp-util');

gulp.task('default', ['build', 'connect', 'watch']);

// Development tasks
// --------------------------------

gulp.task('build', ['build:browserify', 'build:minify']);

gulp.task('build:browserify', function(){
  return gulp.src('./lib/index.js')
    .pipe(through2.obj(function(file, enc, next){
      browserify(file.path)
        .bundle(function(err, res){
            file.contents = res;
            next(null, file);
        });
    }))
    .pipe(strip({ line: true }))
    .pipe(squash())
    .pipe(rename(pkg.name + '.js'))
    .pipe(gulp.dest('./dist/'));
});

gulp.task('build:minify', ['build:browserify'], function(){
  return gulp.src(['./dist/' + pkg.name + '.js'])
    .pipe(compress({ type: 'js' }))
    .pipe(rename({ suffix: '.min' }))
    .pipe(gulp.dest('./dist/'));
});

gulp.task('connect', ['build'], function () {
  return connect.server({
      root: [ __dirname, 'test', 'test/unit', 'test/demo', 'test/vendor' ],
      port: 9001
    });
});

gulp.task('watch', ['build'], function() {
  gulp.watch([ 'lib/**/*.js', 'gulpfile.js' ], ['build']);
});

// Test tasks
// --------------------------------

gulp.task('test:unit', ['test:phantom', 'test:mocha']);

// gulp.task('test:clean', function(callback){
//   del(['./test/unit/build'], callback);
// });

gulp.task('test:browserify', function(){
  return gulp.src('./test/unit/index.js')
    .pipe(through2.obj(function(file, enc, next){
      browserify(file.path)
        .bundle(function(err, res){
            file.contents = res;
            next(null, file);
        });
    }))
    .pipe(strip({ line: true }))
    .pipe(squash())
    .pipe(rename('browserified-tests.js'))
    .pipe(gulp.dest('./test/unit/build'));
});

gulp.task('test:mocha', ['test:browserify'], function () {
  return gulp.src('./test/unit/server.js', { read: false })
    .pipe(mocha({
      reporter: 'nyan',
      timeout: 5000
    }));
});

gulp.task('test:phantom', ['test:browserify'], function () {
  return gulp.src('./test/unit/index.html')
    .pipe(mochaPhantomJS())
    .once('error', function () {
      process.exit(1);
    })
    .once('end', function () {
      process.exit();
    });
});
