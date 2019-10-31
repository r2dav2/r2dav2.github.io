var server = require('http').createServer();
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
		}
		,
		forwardVelocity: 0,
		rotationVelocity: 0
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
		rotationVelocity: 0
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
		cars[n].controlledBy = socket.id;
		players[socket.id].carPossession = n;
	});

	socket.on('uncontrolling-car', n => {
		cars[n].controlledBy = undefined;
		players[socket.id].carPossession = undefined;
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
					console.log(players[socketid].hostedCars.length);
					console.log('assigned car ' + i + ' to socket ' + socketid);
				}
			}
		}
	});
}, 0);

server.listen(8080);