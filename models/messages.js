var mongoose = require('mongoose');

var messageSchema = new mongoose.Schema({
	senderId: String,
	senderName: String,
	chatId: String,
	message: String,
	readBy: [{
		type: String
	}],
	date: { type: Date, default: Date.now }
});

module.exports = mongoose.model('Message',messageSchema);