function CarController(pos = {x: 0, y: 1, z: 0}, rot = {x: 0, y: Math.PI, z: 0}) {
	this.accel = 2000;
	this.decel = 0.7;
	this.rotationAccel = Math.PI * 2;
	this.rotationDecel = 0.1;
	this.breakPower = 0.075;

	this.car = models.car.clone();

	scene.add(this.car);
	this.inScene = true;

	this.car.position.set(pos.x, pos.y, pos.z);
	this.car.rotation.set(rot.x, rot.y, rot.z);

	this.rotationVelocity = 0;
	this.forwardVelocity = 0;
	this.forwardDirection = 1;

	this.playerInCar = false;

	return this;
}

CarController.prototype.left = function() {
	var vec = new THREE.Vector3();
	vec.setFromMatrixColumn(this.car.matrix, 0);
	return vec;
}

CarController.prototype.getSeatOffsets = function() {
	var left = this.left();
	return {
		driver: {
			x: 70 * left.x,
			y: 0,
			z: 70 * left.z
		}
	}
}

CarController.prototype.moveForward = function(dist) {
	if (Math.abs(dist) > 0) {
		var vec = new THREE.Vector3();
		vec.setFromMatrixColumn(this.car.matrix, 0);
		vec.crossVectors(this.car.up, vec);
		this.car.position.addScaledVector(vec, -dist);
	}
}

CarController.prototype.move = function(dt = 0) {
	this.moveForward(dt * this.forwardVelocity);

	var speedMultiplier = Math.min(Math.abs(this.forwardVelocity) / 1000, 1);
	var rotate = dt * this.rotationVelocity * speedMultiplier;
	this.car.rotation.y += rotate;
	if (this.playerInCar) {
		player.rotateView(rotate, 0);
	}

	this.forwardVelocity *= Math.pow(this.decel, dt);
	this.rotationVelocity *= Math.pow(this.rotationDecel, dt);

	this.forwardDirection = Math.sign(this.forwardVelocity);
}

CarController.prototype.accelerate = function(dt) {
	var accelMultiplier = this.forwardVelocity < 0 ? 2 : 1;
	this.forwardVelocity += this.accel * accelMultiplier * dt;
}

CarController.prototype.reverse = function(dt) {
	var accelMultiplier = this.forwardVelocity > 0 ? 2 : 1;
	this.forwardVelocity -= this.accel * accelMultiplier * dt;
}

CarController.prototype.turnRight = function(dt) {
	this.rotationVelocity -= this.rotationAccel * this.forwardDirection * dt;
}

CarController.prototype.turnLeft = function(dt) {
	this.rotationVelocity += this.rotationAccel * this.forwardDirection * dt;
}

CarController.prototype.break = function(dt) {
	this.forwardVelocity *= Math.pow(this.breakPower, dt);
}