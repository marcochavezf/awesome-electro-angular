/**
 * Created by marcochavezf on 10/8/16.
 */
const _ = require('lodash');
const ipc = require('electron').ipcRenderer;
var angularEsprimaFun = require('../angular-esprima-fun/lib');

//Open a directory
const selectDirBtn = document.getElementById('select-directory');
selectDirBtn.addEventListener('click', function (event) {
	ipc.send('open-file-dialog')
});
ipc.on('selected-directory', function (event, path) {
	document.getElementById('selected-file').innerHTML = `Dir. selected: ${path}`;

	angularEsprimaFun.createControllerSemantics(path[0], (controllerSemantics)=> {

		var controllersFiles = controllerSemantics.controllerFiles;
		//Get all controllers from controllerFiles into one array.
		var ctlrsJstreeData = createCtrlrsJstreeData(controllersFiles);
		//Create the JSON jstree data config.
		var jstreeConfig = createJstreeConfig(ctlrsJstreeData);
		$(function() {
			$('#example').jstree('destroy');
			$('#example').jstree(jstreeConfig);
		});
	});
});

/*
//var dirTest = '../angular-esprima-fun/test/file.examples/testB';
var dirTest = '/Users/marcochavezf/GitHub/angular-esprima-fun/test/file.examples/testB';
angularEsprimaFun.createControllerSemantics(dirTest, (controllerSemantics)=> {

	var controllersFiles = controllerSemantics.controllerFiles;
	//Get all controllers from controllerFiles into one array.
	var ctlrsJstreeData = createCtrlrsJstreeData(controllersFiles);
	//Create the JSON jstree data config.
	var jstreeConfig = createJstreeConfig(ctlrsJstreeData);
	$(function() {
		$('#example').jstree(jstreeConfig);
	});
});
*/

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
