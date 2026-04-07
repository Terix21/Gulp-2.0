const gulp = require('gulp');
const sass = require('gulp-sass')(require('sass'));
const esbuild = require('gulp-esbuild');
const clean = require('gulp-clean');
const { execSync } = require('child_process');

const paths = {
  html: 'src/renderer/index.html',
  docs: 'END_USER_GUIDE.md',
  scss: 'src/renderer/scss/**/*.scss',
  js: 'src/renderer/js/**/*.{js,jsx}',
  jsEntry: 'src/renderer/js/main.jsx',
  main: 'src/main/**/*',
  contracts: 'src/contracts/**/*',
  dist: 'dist'
};

function cleanDist() {
  return gulp.src(paths.dist, { read: false, allowEmpty: true })
    .pipe(clean());
}

function copyHtml() {
  return gulp.src(paths.html)
    .pipe(gulp.dest(`${paths.dist}/renderer`));
}

function copyDocs() {
  return gulp.src(paths.docs)
    .pipe(gulp.dest(`${paths.dist}/renderer`));
}

function compileSass() {
  return gulp.src(paths.scss)
    .pipe(sass().on('error', sass.logError))
    .pipe(gulp.dest(`${paths.dist}/renderer/css`));
}

function bundleJs() {
  return gulp.src(paths.jsEntry)
    .pipe(esbuild({
      bundle: true,
      minify: true,
      outfile: 'app.js',
      target: 'es2020',
      loader: {
        '.js': 'jsx',
        '.jsx': 'jsx'
      }
    }))
    .pipe(gulp.dest(`${paths.dist}/renderer/js`));
}

function copyMain() {
  return gulp.src(paths.main)
    .pipe(gulp.dest(`${paths.dist}/main`));
}

function copyContracts() {
  return gulp.src(paths.contracts)
    .pipe(gulp.dest(`${paths.dist}/contracts`));
}

function generateBuildMetadata(done) {
  try {
    execSync(
      `node scripts/versioning/write-build-metadata.js --out=${paths.dist}/contracts/build-info.json`,
      { stdio: 'inherit' }
    );
    done();
  } catch (error) {
    done(error);
  }
}

function watchFiles() {
  gulp.watch(paths.html, copyHtml);
  gulp.watch(paths.docs, copyDocs);
  gulp.watch(paths.scss, compileSass);
  gulp.watch(paths.js, bundleJs);
  gulp.watch(paths.main, copyMain);
  gulp.watch(paths.contracts, copyContracts);
}

const build = gulp.series(cleanDist, gulp.parallel(copyHtml, copyDocs, compileSass, bundleJs, copyMain, copyContracts), generateBuildMetadata);

exports.clean = cleanDist;
exports.watch = watchFiles;
exports.build = build;
exports.default = build;
