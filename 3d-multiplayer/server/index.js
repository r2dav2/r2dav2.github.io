var server = require('http').createServer();
var io = require('socket.io')(server);

var players = {};
var cars = [];

io.sockets.on('connection', socket => {
	console.log(socket.id + ' connected');
	players[socket.id] = {id: socket.id};

	socket.on('update-player', player => {
		var p = players[socket.id];
		p.position = player.position;
		p.rotation = player.rotation;
	});

	socket.on('update-car', car => {
		var c = cars[car.id];
		c.position = car.position;
		c.rotation = car.rotation;
	});

	socket.on('disconnect', () => {
		console.log(socket.id + ' disconnected');
		delete players[socket.id];
		io.emit('remove-player', socket.id);
	});
});

setInterval(() => {
	io.emit('update-players', players);
}, 0);

server.listen(8080);