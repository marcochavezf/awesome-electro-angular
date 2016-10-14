/**
 * Created by marcochavezf on 10/8/16.
 */
////////////////// Libraries
const _ = require('lodash');
const ipc = require('electron').ipcRenderer;
const Configstore = require('configstore');
const watch = require('watch');
const pkg = require('./package.json');

// create a Configstore instance with an unique ID e.g.
// package name and optionally some default values
const conf = new Configstore(pkg.name);
const angularEsprimaFun = require('../angular-esprima-fun/lib');

////////////////// Configuration
var lastPathSelected = null;

//Open a directory
const selectDirBtn = document.getElementById('select-directory');
selectDirBtn.addEventListener('click', function (event) {
	ipc.send('open-file-dialog')
});

ipc.on('selected-directory', selectedDirectoryEvent);

//Check if there's path saved from last session
var pathToFiles = conf.get('path');
if (pathToFiles) {
	selectedDirectoryEvent(null, pathToFiles);
}

///////////////// Functions

function selectedDirectoryEvent(event, path) {
	var pathSelected = path[0];

	//Set watch function
	if (lastPathSelected !== pathSelected) {
		if (lastPathSelected){
			watch.unwatchTree(lastPathSelected);
		}
		watch.watchTree(pathSelected, function (f, curr, prev) {
			if (!(typeof f == "object" && prev === null && curr === null)) {
				//a new file has been added, removed or changed
				selectedDirectoryEvent(null, path);
			}
		});
		lastPathSelected = pathSelected;
	}

	document.getElementById('selected-file').innerHTML = `Dir. selected: ${path}`;
	var loading = document.getElementById('loading');
	loading.style.display = 'block';
	$('#example').jstree('destroy');

	conf.set('path', path);
	angularEsprimaFun.createControllerSemantics(pathSelected, (controllerSemantics)=> {

		var controllersFiles = controllerSemantics.controllerFiles;
		//Get all controllers from controllerFiles into one array.
		var ctlrsJstreeData = createCtrlrsJstreeData(controllersFiles);
		//Create the JSON jstree data config.
		var jstreeConfig = createJstreeConfig(ctlrsJstreeData);

		loading.style.display = 'none';
		$(function() {
			$('#example').jstree(jstreeConfig);
		});
	});
}

function createCtrlrsJstreeData(controllersFiles){
	var controllers = _.reduce(controllersFiles, (controllers, controllerFile)=>{
		return _.concat(controllers, controllerFile.controllerSemantic.controllers)
	}, []);
	//Convert controllers data to jstree data.
	var ctlrsJstreeData = _.map(controllers, (controller)=>{
		var scopeProperies = _.map(controller.scopeProperties, (scopeProp)=> {
			return { "text": scopeProp.name, "type": 'property'}
		});
		var scopeFunctions = _.map(controller.scopeFunctions, (scopeFn)=> {
			return { "text": scopeFn.name, "type": 'function'}
		});
		var children = _.concat(scopeProperies, scopeFunctions);
		return {
			"text" : controller.name,
			"type" : 'controller',
			"children" : children
		};
	});
	return ctlrsJstreeData;
}

function createJstreeConfig(data){
	return {
		'core' : {
			'data' : data
		},
		"types" : {
			"controller" : { "icon" : "./assets/circle_red.png" },
			"property" : { "icon" : "./assets/circle_purple.png" },
			"function" : { "icon" : "./assets/circle_yellow.png" }
		},
		"plugins" : [ "types" ]
	};
}
