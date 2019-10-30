var socket = io.connect('https://4f088c20.ngrok.io');

var pointerLocked = false;
document.addEventListener('pointerlockchange', () => {
	pointerLocked = !pointerLocked;
});

var loader = new THREE.GLTFLoader();
var raycaster = new THREE.Raycaster();

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
	inCar: false,
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

var renderer = new THREE.WebGLRenderer();
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.PCFSoftShadowMap;

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

var floorMaterial = new THREE.MeshFaceMaterial(floorMaterials);
var floor = new THREE.Mesh(floorGeometry, floorMaterial);
floor.material.side = THREE.DoubleSide;
floor.rotation.x = Math.PI / 2;
floor.position.y = 0;
floor.receiveShadow = true;
scene.add(floor);

var models = {};

function CarObject(pos = {x: 0, y: 0, z: 0}, rot = {x: 0, y: 0, z: 0}) {
	this.accel = 10;
	this.decel = 0.999;
	this.rotationAccel = Math.PI / 8;
	this.rotationDecel = 0.7;

	this.car = models.car.clone();

	scene.add(this.car);
	this.inScene = true;

	this.car.position.x = pos.x;
	this.car.position.y = pos.y;
	this.car.position.z = pos.z;

	this.car.rotation.x = rot.x;
	this.car.rotation.y = rot.y;
	this.car.rotation.z = rot.z;

	this.rotationVelocity = 0;
	this.forwardVelocity = 0;

	this.playerInCar = false;

	return this;
}

CarObject.prototype.moveForward = function(dist) {
	if (Math.abs(dist) > 0) {
		var vec = new THREE.Vector3();
		vec.setFromMatrixColumn(this.car.matrix, 0);
		vec.crossVectors(this.car.up, vec);
		this.car.position.addScaledVector(vec, -dist);
	}
}

CarObject.prototype.move = function(dt = 0) {
	this.moveForward(dt * this.forwardVelocity);

	var speedMultiplier = Math.min(this.forwardVelocity / 2000, 1);
	var rotate = dt * this.rotationVelocity * speedMultiplier;
	this.car.rotation.y += rotate;
	if (this.playerInCar) {
		euler.y += rotate;
		camera.quaternion.setFromEuler(euler);
	}

	this.forwardVelocity *= this.decel;
	this.rotationVelocity *= this.rotationDecel;
}

var cars = [];
loader.load('models/pony_cartoon/scene.gltf', gltf => {
	car = gltf.scene;
	models.car = car;

	cars.push(new CarObject({x: 0, y: 1, z: 0}, {x: 0, y: 0, z: 0}));
	cars.push(new CarObject({x: 1000, y: 1, z: 0}, {x: 0, y: 0, z: 0}));
}, undefined, error => {
	console.error(error);
});

player.minY = floor.position.y + player.height;
camera.position.y = player.minY;
camera.position.z = 1000;

$(document).ready(() => {
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

var euler = new THREE.Euler(0, 0, 0, 'YXZ');

$(document).mousemove(e => {
	if (!pointerLocked) return ;

	euler.y += -e.originalEvent.movementX * player.mouseSens;
	euler.x += -e.originalEvent.movementY * player.mouseSens;

	euler.x = Math.max(- Math.PI / 2, Math.min(Math.PI / 2, euler.x));

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

$(document).keypress(e => {
	if (player.inCar && e.keyCode == 101) {
		player.inCar = false;
		player.carPossession.playerInCar = false;
	} else {
		if (e.keyCode == 101) {
			var carIds = [];
			cars.forEach(carObj => {
				carIds.push(carObj.car.id);
			});

			var vec = new THREE.Vector2(0, 0);
			raycaster.setFromCamera(vec, camera);
			var intersects = raycaster.intersectObjects(scene.children, true);
			var n = undefined;
			for (var i in intersects) {
				var result = intersects[i];
				for (var j in carIds) {
					var id = carIds[j];
					var diff = result.object.id - id;
					if (diff <= 7 && diff > 0 && result.distance < 250) { //hacky as shit, but I'm clueless so
						n = j;
						break;
					}
				};
				if (n != undefined) {
					player.inCar = true;
					player.carPossession = cars[n];
					cars[n].playerInCar = true;
					console.log('car ' + n + ' selected');
					break;
				}
			};
		}
	}
});

function playerControls(dt) {
	if (player.inCar) {
		player.forwardVelocity = player.rightVelocity = player.upVelocity = 0;

		var carController = player.carPossession;

		camera.position.x = player.carPossession.car.position.x;
		camera.position.y = player.carPossession.car.position.y + 300;
		camera.position.z = player.carPossession.car.position.z;

		if (keysDown[87]) {
			var accelMultiplier = carController.forwardVelocity < 0 ? 2 : 1;
			carController.forwardVelocity += carController.accel * accelMultiplier;
		}
		if (keysDown[83]) {
			var accelMultiplier = carController.forwardVelocity > 0 ? 2 : 1;
			carController.forwardVelocity -= carController.accel * accelMultiplier;
		}
		if (keysDown[68]) carController.rotationVelocity -= carController.rotationAccel;
		if (keysDown[65]) carController.rotationVelocity += carController.rotationAccel;


	} else {
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
	
}

function moveCars(dt) {
	cars.forEach(car => car.move(dt));
}

function animate() {
	var time = new Date();
	var dt = (time - lastLoop) / 1000;
	lastLoop = time;

	requestAnimationFrame(animate);

	moveCars(dt);
	playerControls(dt);

	renderer.render(scene, camera);
}
var lastLoop = new Date();