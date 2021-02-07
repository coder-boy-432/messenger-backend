var mongoose = require('mongoose');

var userSchema = new mongoose.Schema({
	username: String,
	email: String,
	password: String,
	clientId: [{
		type: String
	}],
	friends: [{ 
		type: mongoose.Schema.Types.ObjectId,
		ref: 'Friend' 
	}]
});

module.exports = mongoose.model('User',userSchema);