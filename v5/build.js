const browserify = require('browserify');
const fse        = require('fs-extra');
const path       = require('path');
const uglify     = require("uglify-es");
const less       = require('less');


const transform = require('./transforms/transforms.js');

const buildPath ='./build';


let Libs = {};
const bundleEntryPoint = (entryPoint, opts)=>{
	let cxt = {
		libs  : Libs,
		build : buildPath,
		less  : '',
		entry : {
			name : path.basename(entryPoint).split('.')[0],
			dir  : path.dirname(entryPoint)
		}
	};

	const bundle = ()=>{
		return new Promise((resolve, reject)=>{
			let bundler = browserify({
					standalone : cxt.entry.name,
					//paths      : opts.shared,
					noParse : []
				})
				.require(entryPoint)
				.transform((file)=>transform(cxt, file), {global : true})
				.on('file', (filepath, libName) => {
					//TODO: Need to find a way to skip paring the lib file
					if(filepath.indexOf('node_modules') !== -1){
						cxt.libs[filepath] = libName;
						//TODO: try excluding to ignoring, https://github.com/browserify/browserify-handbook#ignoring-and-excluding
						//TODO: Look into noParse ?
						bundler._options.noParse.push(libName);
						bundler._external.push(libName);
					}
					//TODO: possibly dynamically add a no parse for assets?
					// Pull in the list of transforms,
					// Test against a super large image file
				});
			bundler.bundle((err, buf) => err ? reject(err) : resolve(buf.toString()))
		});
	};
	const minify = (code)=>{
		const mini = uglify.minify(code);
		if(mini.error) throw mini.error;
		return mini.code;
	};
	const style = ()=>{
		return new Promise((resolve, reject)=>{
			less.render(cxt.less, {
				//paths: _.concat(['./node_modules'], opts.shared),
				//filename: `${name}.less`, Probably not needed
				compress: true,
			}, (err, res) => {
				if(err) reject(err);
				resolve(res.css);
			});
		})
		.then((renderedCSS)=>fse.writeFile(`${buildPath}/${cxt.entry.name}/bundle.css`, renderedCSS))
	};

	const renderer = ()=>{
		// if(opts.static)
	}

	//TODO: Maybe make this be a promise.all?
	return fse.ensureDir(`${buildPath}/${cxt.entry.name}`)
		.then(bundle)
		//.then(minify)
		.then((code)=>fse.writeFile(`${buildPath}/${cxt.entry.name}/bundle.js`, code))
		.then(style)
		.then(renderer)
		.then(()=>{
			Libs = Object.assign(Libs, cxt.libs);
		})
};

const bundleLibs = (opts)=>{
	//TODO: Should list out the libs you are building in logs
	console.log('Building Libs', Object.values(Libs));
	return new Promise((resolve, reject)=>{
		browserify({ /*paths: opts.shared */ }).require(Object.values(Libs))
			.bundle((err, buf) => err ? reject(err) : resolve(buf.toString()))
	})
	//TODO: Minifiying is really slow, try doing it as a transform
	// .then((code)=>{
	// 	const mini = uglify.minify(code);
	// 	if(mini.error) throw mini.error;
	// 	return mini.code
	// })
	.then((code)=>fse.writeFile(`${buildPath}/libs.js`, code))
}

module.exports = (entryPoints, opts)=>{
	if(!Array.isArray(entryPoints)) entryPoints = [entryPoints];
	return fse.emptyDir(buildPath)
		.then(()=>Promise.all(entryPoints.map(bundleEntryPoint)))
		.then(bundleLibs)
		.catch((err)=>{
			console.log(err.message);
		})
};

