var gulp = require('gulp'),
    pkg = require('./package.json');

var aws = require('gulp-awspublish')
    browserify = require('browserify'),
    connect = require('gulp-connect'),
    compress = require('gulp-yuicompressor'),
    karma = require('karma').Server,
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

gulp.task('build', ['build:browserify', 'build:minify', 'test:browserify']);

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
  gulp.watch([
    'lib/**/*.js',
    'gulpfile.js',
    'test/**/*.js'
  ], ['build', 'test:browserify']);
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
  return gulp.src('./test/unit/index.js', { read: false })
    .pipe(mocha({
      reporter: 'nyan',
      timeout: 300 * 1000
    }));
});

gulp.task('test:phantom', ['test:browserify'], function () {
  return gulp.src('./test/unit/index.html')
    .pipe(mochaPhantomJS({
      mocha: {
        reporter: 'nyan',
        timeout: 300 * 1000
      }
    }))
    .once('error', function () {
      process.exit(1);
    })
    .once('end', function () {
      process.exit();
    });
});

gulp.task('test:karma', ['build', 'test:browserify'], function (done){
  new karma({
    configFile: __dirname + '/config-karma.js',
    singleRun: true
  }, done).start();
});

gulp.task('test:sauce', ['build', 'test:browserify'], function(done){
  new karma({
    configFile: __dirname + '/config-sauce.js',
    singleRun: true
  }, done).start();
});

// ---------------------

gulp.task('deploy', ['build', 'test:mocha', 'test:karma'], function() {
  var cacheLife, publisher, headers;
  if (!process.env.AWS_KEY || !process.env.AWS_SECRET) {
    throw 'AWS credentials are required!';
  }
  cacheLife = (1000 * 60 * 60); // 1 hour (* 24 * 365)
  headers = {
    'Cache-Control': 'max-age=' + cacheLife + ', public'
  };
  publisher = aws.create({
    'accessKeyId': process.env.AWS_KEY,
    'secretAccessKey': process.env.AWS_SECRET,
    'params': {
      'Bucket': 'keen-js',
      'Expires': new Date(Date.now() + cacheLife)
    }
  });

  return gulp.src([
      './dist/' + pkg.name + '.js',
      './dist/' + pkg.name + '.min.js'
    ])
    .pipe(rename(function(path) {
      path.dirname += '/';
      var name = pkg.name + '-' + pkg.version;
      path.basename = (path.basename.indexOf('min') > -1) ? name + '.min' : name;
    }))
    .pipe(aws.gzip())
    .pipe(publisher.publish(headers, { force: true }))
    .pipe(publisher.cache())
    .pipe(aws.reporter());

});
