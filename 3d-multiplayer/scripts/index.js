var socket = io.connect('https://4f088c20.ngrok.io');

var pointerLocked = false;
document.addEventListener('pointerlockchange', () => {
	pointerLocked = !pointerLocked;
});

var loader = new THREE.GLTFLoader();

var player = {
	height: 325,
	accel: 50,
	offGroundAccel: 10,
	decel: 0.95,
	offGroundDecel: 0.99,
	jumpHeight: 850,
	gravity: 2000,
	forwardVelocity: 0,
	rightVelocity: 0,
	upVelocity: 0,
	canMove: true,
	mouseSens: 0.002,
	moveForward: function(dist) {
		var vec = new THREE.Vector3();
		vec.setFromMatrixColumn(camera.matrix, 0);
		vec.crossVectors(camera.up, vec);
		camera.position.addScaledVector(vec, dist);
	},
	moveRight: function(dist) {
		var vec = new THREE.Vector3();
		vec.setFromMatrixColumn(camera.matrix, 0);
		camera.position.addScaledVector(vec, dist);
	}
}

var scene = new THREE.Scene();
scene.background = new THREE.Color('white');
var camera = new THREE.PerspectiveCamera(75, window.innerWidth / window.innerHeight, 0.1, 100000);
var renderer;

/*var geometry = new THREE.BoxGeometry(1, 1, 1);
var material = new THREE.MeshStandardMaterial({color: 'red'});
cube = new THREE.Mesh(geometry, material);
cube.castShadow = true;
scene.add(cube);*/

var sunlight = new THREE.DirectionalLight('white', 0.75);
sunlight.position.set(10000, 10000, 10000);
sunlight.target.position.set(0, 0, 0);
sunlight.castShadow = true;
scene.add(sunlight);

var hemiLight = new THREE.HemisphereLight(0xffffff, 0xffffff, 0.8);
scene.add(hemiLight);

var floorGeometry = new THREE.PlaneGeometry(10000, 10000, 64, 64);
var floorMaterials = [];
floorMaterials.push(new THREE.MeshStandardMaterial({color: 'white', side: THREE.DoubleSide}));
floorMaterials.push(new THREE.MeshStandardMaterial({color: 'black', side: THREE.DoubleSide}));

for (var i = 0; i < floorGeometry.faces.length; i += 2) {
	var index = (i / 2 + Math.floor(i / 128)) % 2;
	floorGeometry.faces[i].materialIndex = index;
	floorGeometry.faces[i + 1].materialIndex = index;
}

//var floorMaterial = new THREE.MeshStandardMaterial({color: 'red'});
var floorMaterial = new THREE.MeshFaceMaterial(floorMaterials);
var floor = new THREE.Mesh(floorGeometry, floorMaterial);
floor.material.side = THREE.DoubleSide;
floor.rotation.x = Math.PI / 2;
floor.position.y = 0;
floor.receiveShadow = true;
scene.add(floor);

var car = undefined;
loader.load('models/pony_cartoon/scene.gltf', gltf => {
	car = gltf.scene;
	scene.add(car);

	car.position.y = 1;
}, undefined, error => {
	console.error(error);
});

player.minY = floor.position.y + player.height;
camera.position.y = player.minY;
camera.position.z = 1000;

$(document).ready(() => {
	renderer = new THREE.WebGLRenderer();
	renderer.shadowMap.enabled = true;
	renderer.shadowMap.type = THREE.PCFSoftShadowMap;
	renderer.setSize(window.innerWidth, window.innerHeight);
	document.body.appendChild(renderer.domElement);

	$(renderer.domElement).click(function(e) {
		if (pointerLocked) return ;
		this.requestPointerLock = this.requestPointerLock ||
					     this.mozRequestPointerLock ||
					     this.webkitRequestPointerLock;
		this.requestPointerLock();
	});
	
	animate();
});

var mouse = {x: 0, y: 0};
var euler = new THREE.Euler(0, 0, 0, 'YXZ');

$(document).mousemove(e => {
	if (!pointerLocked) return ;

	var min = (Math.PI / 2) / player.mouseSens;

	mouse.x += e.originalEvent.movementX;
	mouse.y += e.originalEvent.movementY;

	mouse.y = Math.max(-min, Math.min(min, mouse.y));

	euler.y = -mouse.x * player.mouseSens;
	euler.x = -mouse.y * player.mouseSens;

	//euler.x = Math.max(- Math.PI / 2, Math.min(Math.PI / 2, euler.x));

	camera.quaternion.setFromEuler(euler);
});

$(window).resize(() => {
	camera.aspect = window.innerWidth / window.innerHeight;
	camera.updateProjectionMatrix();
	renderer.setSize(window.innerWidth, window.innerHeight);
});

var keysDown = [];
$(document).keydown(e => {
	keysDown[e.keyCode] = true;
});

$(document).keyup(e => {
	keysDown[e.keyCode] = false;
});

function playerControls(dt) {
	var touchingGround = camera.position.y == player.minY;
	var accel = touchingGround ? player.accel : player.offGroundAccel;
	var decel = touchingGround ? player.decel : player.offGroundDecel;

	if (keysDown[87]) player.forwardVelocity += accel;
	if (keysDown[83]) player.forwardVelocity -= accel;
	if (keysDown[68]) player.rightVelocity += accel;
	if (keysDown[65]) player.rightVelocity -= accel;

	if (keysDown[32] && touchingGround) player.upVelocity = player.jumpHeight; 

	player.moveForward(dt * player.forwardVelocity);
	player.moveRight(dt * player.rightVelocity);
	camera.position.y = Math.max(player.minY, camera.position.y + dt * player.upVelocity);
	if (touchingGround && player.upVelocity < 0) player.upVelocity = 0;

	player.forwardVelocity *= decel;
	player.rightVelocity *= decel;
	player.upVelocity -= dt * player.gravity;
}

function animate() {
	var time = new Date();
	var dt = (time - lastLoop) / 1000;
	lastLoop = time;

	requestAnimationFrame(animate);

	//cube.rotation.x += (Math.PI / 2) * dt;
	//cube.rotation.y += (Math.PI / 2) * dt;

	playerControls(dt);

	if (car != undefined) {
		var theta = (time.getTime() / 1000);

		car.position.x = Math.cos(theta) * 1000;
		car.position.z = Math.sin(theta) * 1000;

		car.rotation.y = -theta; 
	}

	renderer.render(scene, camera);
}
var lastLoop = new Date();