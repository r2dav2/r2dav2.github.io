var server = require('http').createServer();
var io = require('socket.io')(server);

io.sockets.on('connection', socket => {
	console.log(socket.id + ' connected');

	socket.on('disconnect', () => {
		console.log(socket.id + ' disconnected');
	});
});

server.listen(8080);