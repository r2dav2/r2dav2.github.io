//var socket = io.connect('https://4f088c20.ngrok.io');
var socket = io.connect('https://100.14.69.172:25565', {secure: true, rejectUnauthorized: false});

var pointerLocked = false;
document.addEventListener('pointerlockchange', () => {
	pointerLocked = !pointerLocked;
});

var groundLevel = 0;

var player = new Player();

var loader = new THREE.GLTFLoader();
var raycaster = new THREE.Raycaster();

var scene = new THREE.Scene();
scene.background = new THREE.Color('white');
scene.fog = new THREE.Fog('white', 7500, 25000);

var camera = new THREE.PerspectiveCamera(75, window.innerWidth / window.innerHeight, 15, 25000);

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

var models = {};

function PlayerCharacter() {
	this.object = models.elf.clone(); 
	scene.add(this.object);

	this.object.scale.x = this.object.scale.y = this.object.scale.z = 40;

	/*this.object.scale.x = this.object.scale.y = this.object.scale.z = 4.5;
	this.object.rotation.x = -Math.PI / 2;
	this.object.position.y = 20;*/

	return this;
}

var cars = [];
var hostedCars = [];
socket.on('spawn-cars', cars => {
	loader.load('models/pony_cartoon/model.glb', gltf => {
		car = gltf.scene;
		models.car = car;

		cars.forEach(car => {
			var carController = new CarController(car.position, {
				x: car.rotation.x,
				y: car.rotation.y,
				z: car.rotation.z
			});

			carController.controlledBy = car.controlledBy;

			window.cars.push(carController);
		});
	}, undefined, error => {
		console.error(error);
	});
});

socket.on('host-car', car => {
	hostedCars.push(car.id);
	var carController = cars[car.id];
	if (carController != undefined) {
		carController.car.position.set(car.position.x, car.position.y, car.position.z);
		carController.car.rotation.set(car.rotation.x, car.rotation.y, car.rotation.z);
		carController.forwardVelocity = car.forwardVelocity;
		carController.rotationVelocity = car.rotationVelocity;
	}
});

player.setPosition({y: player.minY, z: 1000});

loader.load('models/city_building_set_1/scene.gltf', gltf => {
	models.city = gltf.scene;
	scene.add(gltf.scene);
});

var playerCharacters = {};
loader.load('models/elf/scene.gltf', gltf => {
	models.elf = gltf.scene;
});

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

	player.rotateView(-e.originalEvent.movementX * player.mouseSens, -e.originalEvent.movementY * player.mouseSens);
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
	if (player.inCar) {
		if (e.keyCode == 101) {
			player.exitCar();
		}
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
					if (cars[n].controlledBy == undefined) {
						player.inCar = true;
						player.carPossession = cars[n];
						player.carNumber = n;
						player.setView(cars[n].car.rotation.y + Math.PI, player.view.x);					
						cars[n].playerInCar = true;

						socket.emit('controlling-car', n);
					} else console.log('car already taken!');

					break;
				}
			};
		}
	}
});

function moveCars(dt) {
	cars.forEach(car => car.move(dt));
}

socket.on('update-players', players => {
	if (models.elf) {
		for (var player in players) {
			player = players[player];
			if (player.id != socket.id) {
				if (!playerCharacters[player.id]) playerCharacters[player.id] = new PlayerCharacter();
				var playerChar = playerCharacters[player.id];
				if (player.position) {
					playerChar.object.position.x = player.position.x;
					playerChar.object.position.y = player.position.y;
					playerChar.object.position.z = player.position.z;
				}
				if (player.rotation) {
					playerChar.object.rotation.x = player.rotation.x;
					playerChar.object.rotation.y = player.rotation.y;
					playerChar.object.rotation.z = player.rotation.z;
				}
			}
		}
	} else console.log('loading models');
});

socket.on('car-controlled-by', data => {
	cars[data.carNumber].controlledBy = data.user;
});

socket.on('car-uncontrolled', carNumber => {
	cars[carNumber].controlledBy = undefined;
});

socket.on('update-car', car => {
	var carController = cars[car.id];
	if (carController) {
		carController.car.position.set(car.position.x, car.position.y, car.position.z);
		carController.car.rotation.set(car.rotation.x, car.rotation.y, car.rotation.z);
	}
});

socket.on('remove-player', id => {
	if (playerCharacters[id] != undefined) {
		scene.remove(playerCharacters[id].object);
		delete playerCharacters[id];
	}
});

function animate() {
	var time = new Date();
	var dt = (time - lastLoop) / 1000;
	lastLoop = time;

	requestAnimationFrame(animate);

	moveCars(dt);
	player.handleControls(dt);

	renderer.render(scene, camera);

	socket.emit('update-player', {
		position: {
			x: player.position.x,
			y: player.position.y,
			z: player.position.z
		},
		rotation: {
			x: 0,
			y: player.view.y + Math.PI,
			z: 0
		}
	});

	if (player.inCar) {
		socket.emit('update-car', {
			id: player.carNumber,
			position: player.carPossession.car.position,
			rotation: {
				x: player.carPossession.car.rotation.x,
				y: player.carPossession.car.rotation.y,
				z: player.carPossession.car.rotation.z
			},
			forwardVelocity: player.carPossession.forwardVelocity,
			rotationVelocity: player.carPossession.rotationVelocity
		});
	}

	if (hostedCars.length) {
		var deleted = 0;
		hostedCars.forEach((carNumber, i) => {
			var carController = cars[carNumber];
			socket.emit('update-car', {
				id: carNumber,
				position: carController.car.position,
				rotation: {
					x: carController.car.rotation.x,
					y: carController.car.rotation.y,
					z: carController.car.rotation.z
				},
				forwardVelocity: carController.forwardVelocity,
				rotationVelocity: carController.rotationVelocity
			});

			if (Math.abs(carController.forwardVelocity) <= 5 && Math.abs(carController.rotationVelocity) <= 5) {
				unhostCar(carNumber);
			}
		});
	}
}

socket.on('unhost-car', carNumber => {
	unhostCar(carNumber);
});

function unhostCar(n) {
	n = parseInt(n);
	var i = hostedCars.indexOf(n);
	if (i != -1) {
		hostedCars.splice(i, 1);
		socket.emit('unhost-car', n);
	}
}

var lastLoop = new Date();