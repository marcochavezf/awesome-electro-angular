/**
 * Created by marcochavezf on 10/8/16.
 */
////////////////// Libraries
const _ = require('lodash');
const ace = require('brace');
const Configstore = require('configstore');
const {dialog} = require('electron').remote; // access native file picker dialog
const fs = require('fs'); // file system access directly from browser code!
const ipc = require('electron').ipcRenderer;
const pkg = require('./package.json');
const watch = require('watch');
require('brace/mode/javascript');
require('brace/theme/monokai');

// create a Configstore instance with an unique ID e.g.
// package name and optionally some default values
const conf = new Configstore(pkg.name);
const angularEsprimaFun = require('../angular-esprima-fun/lib');

////////////////// Configuration
var editor = ace.edit('editor');
editor.getSession().setMode('ace/mode/javascript');
editor.setTheme('ace/theme/monokai');

var lastPathSelected = null;

//init();
initPrototype();

///////////////// Functions

function initPrototype(){
	var cpuProfilePath = '../angular-esprima-fun/test/prototype/CPU-20161215T223525.cpuprofile';
	angularEsprimaFun.testPrototype(cpuProfilePath, function(projectNodes, error){
		if (error) {
			return;
		}
		var lastPathFileSelected;
		var jstreeData = convertToJsTreeData(projectNodes);
		$('#code-nodes')
			.on('select_node.jstree', function (e, data) {
				var callFrame = data.node.data;
				var path = conf.get('path');
				var shortenUrl = _.replace(callFrame.url, 'http://dev.primotus.com:8080/', '');
				var pathFile = path[0] + '/' + shortenUrl;

				/* If last pathFile selected is not the same then open a new file
				 * otherwise just go to the line. */
				if (lastPathFileSelected !== pathFile) {
					lastPathFileSelected = pathFile;

					open(lastPathFileSelected, ()=>{
						editor.gotoLine(callFrame.lineNumber, callFrame.columnNumber);
						editor.getSession().setUndoManager(new ace.UndoManager());
					});
				} else {

					editor.gotoLine(callFrame.lineNumber, callFrame.columnNumber);
				}
			})
			.jstree({ 'core' : { 'data' : jstreeData } });
	});

	//Open a directory
	const selectDirBtn = document.getElementById('select-directory');
	selectDirBtn.addEventListener('click', function (event) {
		ipc.send('open-file-dialog')
	});

	ipc.on('selected-directory', (event, path) => {
		console.log(event, path);
		conf.set('path', path);
		document.getElementById('selected-file').innerHTML = `Dir. selected: ${path}`;
	});

	var path = conf.get('path');
	if (path) {
		document.getElementById('selected-file').innerHTML = `Dir. selected: ${path}`;
	}
}

function convertToJsTreeData(projectNodes){
	return _.map(projectNodes, (node)=>{
		return {
			'id': node.id,
			'text': getTextNode(node),
			'children': convertToJsTreeData(node.childrenNodes),
			'data': node.callFrame
		}
	});
}

function getTextNode(node){
	var shortenUrl = _.replace(node.callFrame.url, 'http://dev.primotus.com:8080/', '');
	var functionName = node.callFrame.functionName ? node.callFrame.functionName + '()' : '';
	return functionName + ' - ' + shortenUrl + ':' + node.callFrame.lineNumber;
}

function init(){

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
}

function selectedDirectoryEvent(event, path) {
	var pathSelected = path[0];

	//Set watch function
	if (lastPathSelected !== pathSelected) {
		if (lastPathSelected){
			watch.unwatchTree(lastPathSelected);
		}
		watch.watchTree(pathSelected, function (f, curr, prev) {
			if (!(typeof f == 'object' && prev === null && curr === null)) {
				//a new file has been added, removed or changed
				selectedDirectoryEvent(null, path);
			}
		});
		lastPathSelected = pathSelected;
	}

	document.getElementById('selected-file').innerHTML = `Dir. selected: ${path}`;
	var loading = document.getElementById('loading');
	var htmlEditor = document.getElementById('editor');
	loading.style.display = 'block';
	htmlEditor.style.display = 'none';

	$('#code-nodes').jstree('destroy');

	conf.set('path', path);
	angularEsprimaFun.createControllerSemantics(pathSelected, (controllerSemantics)=> {

		var controllersFiles = controllerSemantics.controllerFiles;
		//Get all controllers from controllerFiles into one array.
		var ctlrsJstreeData = createCtrlrsJstreeData(controllersFiles);
		//Create the JSON jstree data config.
		var jstreeConfig = createJstreeConfig(ctlrsJstreeData);

		loading.style.display = 'none';
		htmlEditor.style.display = 'block';
		editor.resize();
		editor.renderer.updateFull();

		var lastPathFileSelected;

		$(function() {
			$('#code-nodes')
				.on('select_node.jstree', function (e, data) {

					var loc = data.node.data.loc.start;

					/* If last pathFile selected is not the same then open a new file
					 * otherwise just go to the line. */
					if (lastPathFileSelected !== data.node.data.pathFile) {
						lastPathFileSelected = data.node.data.pathFile;

						open(lastPathFileSelected, ()=>{
							editor.gotoLine(loc.line, loc.column);
							editor.getSession().setUndoManager(new ace.UndoManager());
						});
					} else {

						editor.gotoLine(loc.line, loc.column);
					}

				})
				.jstree(jstreeConfig);
		});
	});
}


function createCtrlrsJstreeData(controllersFiles){
	var controllers = _.reduce(controllersFiles, (controllers, controllerFile)=>{
		//Append pathFile to node data controllers
		_.each(controllerFile.controllerSemantic.controllers, (controller)=>{
			controller.node.pathFile = controllerFile.pathFile;
		});
		return _.concat(controllers, controllerFile.controllerSemantic.controllers)
	}, []);
	//Convert controllers data to jstree data.
	var ctlrsJstreeData = _.map(controllers, (controller)=>{
		var scopeProperies = _.map(controller.scopeProperties, (scopeProp)=> {
			//Append pathFile to each property
			scopeProp.node.pathFile = controller.node.pathFile;
			return { 'text': '$scope.' + scopeProp.name, 'type': 'property', 'data': scopeProp.node }
		});
		var scopeFunctions = _.map(controller.scopeFunctions, (scopeFn)=> {
			//Append pathFile to each function
			scopeFn.node.pathFile = controller.node.pathFile;
			return { 'text': '$scope.' + scopeFn.name + '()',  'type': 'function', 'data': scopeFn.node }
		});
		var children = _.concat(scopeProperies, scopeFunctions);
		return {
			'text' : controller.name,
			'type' : 'controller',
			'children' : children,
			'data': controller.node
		};
	});
	return ctlrsJstreeData;
}

function createJstreeConfig(data){
	return {
		'core' : {
			'data' : data
		},
		'types' : {
			'controller' : { 'icon' : './assets/circle_red.png' },
			'property' : { 'icon' : './assets/circle_purple.png' },
			'function' : { 'icon' : './assets/circle_yellow.png' }
		},
		'plugins' : [ 'types' ]
	};
}


/**
 * Opens a file in the editor
 * @param {String} [fileToOpen] A specific file to open.  Omit to show the open dialog.
 */
function open(fileToOpen, callback) {
	const doOpen = (f) => {
		file = f;
		fs.readFile(f, 'utf8', (error, contents) => {
			console.log('contents', contents);

			if (error) {
				new Notification('charmCity-electron', { body: `Could not open ${f} : ${error}` });
			} else {
				// new Notification('charmCity-electron', { body: `Opened ${f}.` });
				editor.setValue(contents);
				callback();
			}
		});
	};

	if (fileToOpen) {
		doOpen(fileToOpen);
	} else {
		getFile().then(doOpen)
	}
}

/**
 * Saves the contents of the editor
 */
function save() {
	const write = (file) => {
		fs.writeFile(file, editor.getValue(), 'utf8', (error) => {
			if (error) {
				new Notification('charmCity-electron', { body: `Could not write to ${file}: ${error}` });
			} else {
				new Notification('charmCity-electron', { body: `Contents written to ${file}.` });
			}
		});
	};

	if (file) {
		write(file);
	} else {
		dialog.showSaveDialog({ title: 'Select Location' }, filename => {
			file = filename;
			write(file);
		})
	}
}

/**
 * Prompts the user for a file selection using the electron native file dialog
 * @returns {Promise}
 */
function getFile() {
	return new Promise((resolve, reject) => {
		dialog.showOpenDialog({ properties: [ 'openFile' ] }, selectedFile => {
			if (selectedFile && selectedFile[0]) {
				file = selectedFile[0];
				resolve(file);
			}
		});
	});
}
