var mongoose = require('mongoose');

var UsernameSchema = new mongoose.Schema({
	// userId: mongoose.Schema.Types.ObjectId,
	userId: String,
	username: String,
	unread: Number,
	online: Boolean
});

var friendSchema = new mongoose.Schema({
	userId: [{
		type: String
	}],
	userData: [UsernameSchema],
	name: String,
	admins:  [{
		type: String
	}],
	chats: [
		{
			type: mongoose.Schema.Types.ObjectId,
			ref: "Message"
		}
	]
});

module.exports = mongoose.model('Friend',friendSchema);