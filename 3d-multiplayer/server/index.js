const fs = require('fs');

const options = {
	key: fs.readFileSync('client-key.pem'),
	cert: fs.readFileSync('client-cert.pem'),
	requestCert: false,
	rejectUnauthorized: false
};

var server = require('https').createServer(options);

var io = require('socket.io')(server);

var players = {};
var cars = [
	{
		position: {
			x: 0,
			y: 1,
			z: 0
		},
		rotation: {
			x: 0,
			y: Math.PI,
			z: 0
		},
		forwardVelocity: 0,
		rotationVelocity: 0,
		controlledBy: undefined
	},
	{
		position: {
			x: 1000,
			y: 1,
			z: 0
		},
		rotation: {
			x: 0,
			y: Math.PI,
			z: 0
		},
		forwardVelocity: 0,
		rotationVelocity: 0,
		controlledBy: undefined
	}
];

io.sockets.on('connection', socket => {
	console.log(socket.id + ' connected');
	players[socket.id] = {
		id: socket.id,
		hostedCars: []
	};

	socket.emit('spawn-cars', cars);

	socket.on('update-player', player => {
		var p = players[socket.id];
		if (p != undefined) {
			p.position = player.position;
			p.rotation = player.rotation;
		}
	});

	socket.on('update-car', car => {
		var c = cars[car.id];
		c.position = car.position;
		c.rotation = car.rotation;
		c.forwardVelocity = car.forwardVelocity;
		c.rotationVelocity = car.rotationVelocity;
		socket.broadcast.emit('update-car', {
			id: car.id,
			position: car.position,
			rotation: car.rotation
		});
	});

	socket.on('controlling-car', n => {
		if (cars[n].hostedBy != null) {
			var socketid = cars[n].hostedBy;
			io.to(socketid).emit('unhost-car', n);
		}
		cars[n].controlledBy = socket.id;
		players[socket.id].carPossession = n;

		io.emit('car-controlled-by', {
			user: socket.id,
			carNumber: n
		});
	});

	socket.on('uncontrolling-car', n => {
		cars[n].controlledBy = undefined;
		cars[n].hostedBy = undefined;
		players[socket.id].carPossession = undefined;

		io.emit('car-uncontrolled', n);
	});

	socket.on('disconnect', () => {
		console.log(socket.id + ' disconnected');

		var controlledCar = players[socket.id].carPossession;
		if (controlledCar != undefined) cars[controlledCar].controlledBy = undefined;

		var hostedCars = players[socket.id].hostedCars;
		hostedCars.forEach(n => {
			cars[n].hostedBy = undefined;
		});

		delete players[socket.id];
		io.emit('remove-player', socket.id);
	});

	socket.on('unhost-car', carNumber => {
		if (cars[carNumber].hostedBy != undefined) cars[carNumber].hostedBy = undefined;
		
		var i = players[socket.id].hostedCars.indexOf(carNumber);
		if (i != -1) players[socket.id].hostedCars.splice(i, 1);
	});
});

setInterval(() => {
	io.emit('update-players', players);

	cars.forEach((car, i) => {
		if (car.controlledBy == undefined && car.hostedBy == undefined) {
			//player not hosting car
			if (Math.abs(car.rotationVelocity) > 5 || Math.abs(car.forwardVelocity) > 5) {
				//find new car host
				var keys = Object.keys(players);
				if (keys[0] != undefined) {
					var socketid = keys[0];
					io.to(socketid).emit('host-car', {
						id: i,
						position: car.position,
						rotation: car.rotation,
						forwardVelocity: car.forwardVelocity,
						rotationVelocity: car.rotationVelocity
					});
					car.hostedBy = socketid;
					players[socketid].hostedCars.push(i);
				}
			}
		}
	});
}, 0);

server.listen(25565);