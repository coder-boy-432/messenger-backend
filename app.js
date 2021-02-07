var app = require('express')();
var server = require('http').createServer(app);
var mongoose = require('mongoose');
var bodyParser       = require("body-parser");
var jwt = require('jsonwebtoken');
var bcrypt = require('bcrypt');
var User = require("./models/users");
var Friend = require('./models/friends');
var Message = require('./models/messages');
var PORT = process.env.PORT || 4000;

// mongoose.connect("mongodb://localhost/messenger", {useNewUrlParser: true,useUnifiedTopology: true});
mongoose.connect(process.env.DATABASE_URL, {
	useNewUrlParser: true,
	useUnifiedTopology: true,
	useCreateIndex: true
}).then(() => {
	console.log('Connected to db');
}).catch(err => {
	console.log('Error DB: ' + err);
});

app.use(bodyParser.urlencoded({extended: true}));
app.use(bodyParser.json());

// For CORS policy
// app.use((req,res,next) => {
// 	res.header('Access-Control-Allow-Origin' , '*');
// 	res.header('Access-Control-Allow-Headers', 'Origin, X-Requested-With, Content-Type, accept, Authorization, accept');
// 	next();
// });

app.use(function(req, res, next) {
    res.header("Access-Control-Allow-Origin", '*');
    res.header("Access-Control-Allow-Credentials", true);
    res.header('Access-Control-Allow-Methods', 'GET,PUT,POST,DELETE,OPTIONS');
    res.header("Access-Control-Allow-Headers", 'Origin, X-Requested-With, Content-Type, accept, Authorization, accept');
    next();
});


var io = require('socket.io')(server,{
	transports: ["websocket", "polling"]
});

let UserData = [];
const users = {};

app.get('/', (req,rs) => {
	res.send(UserData);
});

app.post('/search', verifyToken, (req,res) => {
	console.log(req.authData);
	User.find({username: {$regex: req.body.searchTerm, $options: "i"}}, (err,foundUsers) => {
		if(err){
			console.log(err);
		} else {
			console.log(foundUsers);
			res.send(foundUsers);
		}
	});
});

app.post('/addfriend', verifyToken ,async (req,res) => {
	// const friend = {
	// 	userId: mongoose.Types.ObjectId(req.authData.localId),
	// 	friendId: mongoose.Types.ObjectId(req.body.friendId),
	// 	username: req.body.username,
	// 	unread: 0
	// }
	
	var friend1 = {
		userData: [],
		userId: []
	}
	
	// const friend2 = {
	// 	userId: mongoose.Types.ObjectId(req.body.friendId),
	// 	friendId: mongoose.Types.ObjectId(req.authData.localId),
	// 	username: req.body.username,
	// 	unread: 0
	// }
	
	console.log('id is is ...');
	console.log(req.authData);
	const localId = req.authData.foundUser._id;
	
	await User.findById(localId, (err,foundUser) => {
		if(err) {
			console.log(err);
		} else {
			console.log(foundUser);
			const userData1 = {
						userId: foundUser._id,
						username: foundUser.username,
						unread: 0,
						online: foundUser.clientId.length > 0
					}
			console.log(userData1);
					const clientId = [...foundUser.clientId];
					friend1.userData.push(userData1);
					// friend1.clientId = friend1.clientId.concat(clientId);
					friend1.userId.push(localId);
			// console.log('friend is....');
			// console.log(friend1);
		}
	});
	
	await User.findById(req.body.friendId, (err,foundUser) => {
		if(err) {
			console.log(err);
		} else {
			const userData1 = {
						userId: foundUser._id,
						username: foundUser.username,
						unread: 0,
						online: foundUser.clientId.length > 0
					}
					const clientId = [...foundUser.clientId];
					friend1.userData.push(userData1);
					// friend1.clientId = friend1.clientId.concat(clientId);
					friend1.userId.push(req.body.friendId);
		}
	});
	
	console.log('User Data is..');
	
	console.log(friend1);
	
	await Friend.create(friend1,async (err,newFriend) => {
		if(err) {
			console.log(err);
		} else {
			console.log(newFriend)
			await User.findById(localId, (err,foundUser) => {
				if(err) {
					console.log(err)
				} else {
					console.log('for first User');
					console.log(newFriend);
					foundUser.friends.push(newFriend);
					foundUser.clientId.forEach(idClient => {
						// io.sockets[idClient].join(newFriend._id);
						io.sockets.connected[idClient].join(newFriend._id);
					});
					foundUser.save();
				}
			});
			await User.findById(req.body.friendId, (err,foundUser) => {
				if(err) {
					console.log(err)
				} else {
					console.log('for second User');
					console.log(newFriend);
					foundUser.friends.push(newFriend);
					foundUser.clientId.forEach(idClient => {
						// io.sockets[idClient].join(newFriend._id);
						io.sockets.connected[idClient].join(newFriend._id);
					});
					foundUser.save();
				}
			});
			io.sockets.in(newFriend._id).emit('addNewFriend', newFriend);
			res.send({
				friendId: req.body.friendId
			});
		}
	});
	
	//end here
	
	// Friend.create(friend, (err,newFriend) => {
	// 	if(err) {
	// 		console.log(err);
	// 	} else {
	// 		console.log(newFriend);
	// 		res.send("Ok");
	// 	}
	// });
	// Friend.find({userId: req.body.userId}, (err,foundFriend) => {
	// 	if(err) {
	// 		console.log(err);
	// 	} else {
	// 		console.log('The friend that was found is...');
	// 		console.log(foundFriend);
	// 	}
	// });
});

app.post('/creategroup', verifyToken, (req,res) => {
	var friend1 = {
		userData: [],
		userId: [],
		name: '',
		admins: []
	};
	const localId = req.authData.foundUser._id;
	const tempUser = {
		username: req.authData.foundUser.username,
		userId:  req.authData.foundUser._id,
		checked: true
	}; 
	let tempBody = {...req.body};
	tempBody.users.push(tempUser);
	tempBody.users.forEach(user => {
		friend1.userData.push({
			userId: user.userId,
			username: user.username,
			unread: 0,
			online: false
		});
		friend1.userId.push(user.userId);
	});
	friend1.name = tempBody.name;
	friend1.admins.push(req.authData.foundUser._id.toString());
	Friend.create(friend1,(err,newFriend) => {
		if(err) {
			console.log(err);
		} else {
			console.log('Group created is ...');
			console.log(newFriend);
			newFriend.userId.forEach(idUser => {
				User.findById(idUser, (err,foundUser) => {
					if(err) {
						console.log(err)
					} else {
						console.log('for a grroup User ...');
						foundUser.friends.push(newFriend);
						foundUser.clientId.forEach(idClient => {
							// io.sockets[idClient].join(newFriend._id);
							io.sockets.connected[idClient].join(newFriend._id);
							io.to(idClient).emit('addNewFriend', newFriend);
						});
						foundUser.save();
					}
				});
			});
			// io.sockets.in(newFriend._id).emit('addNewFriend', newFriend);
			res.send(newFriend);
		}
	});
});

app.post('/readmessages/:id', verifyToken, (req,res) => {
	console.log('Reached readmessages route ......................');
	Friend.findById(req.params.id,async (err,foundFriend) => {
		if(err) {
			console.log(err);
		} else {
			const localId = req.authData.foundUser._id;
			
			// const tempIdList =  req.body.messagesRead.map(message => {
			// 	return message._id.toString();
			// });
			// foundFriend.chats.forEach(message => {
			// 	if(message._id.toString() in tempIdList) {
			// 		message.readBy = message.readBy.concat(localId.toString());
			// 	}
			// });
			let count = 0;
			let tempList = [];
			
			if(req.body.messagesRead.length > 0) {
				for (const message of req.body.messagesRead) {
					await Message.findById(message._id,(err,foundMessage) => {
						if(err || foundMessage === null) {
							console.log(err);
						} else {
							if(foundMessage.readBy.includes(localId.toString())) {
								
							} else {
								tempList.push(message._id);
								count = count + 1;
								foundMessage.readBy = foundMessage.readBy.concat(localId.toString());
								foundMessage.save();
								console.log(count);
							}
						}
					});
					console.log('Andar wala hai ye - ' + count);
				}	
			}
			
			// await req.body.messagesRead.forEach(async message => {
			// 	console.log('Message found was ................');
			// 	await Message.findById(message._id,(err,foundMessage) => {
			// 		if(err) {
			// 			console.log(err);
			// 		} else {
			// 			if(foundMessage.readBy.includes(localId.toString())) {
							
			// 			} else {
			// 				count = count + 1;
			// 				foundMessage.readBy = foundMessage.readBy.concat(localId.toString());
			// 				foundMessage.save();
			// 				console.log(count);
			// 			}
			// 		}
			// 	});
			// 	console.log('Andar wala hai ye - ' + count);
			// });
			console.log(count);
			
			const tempObj = {
				chatId: req.params.id,
				readerId: localId.toString(),
				messageIdList: tempList
			}
			
			foundFriend.userData.forEach(user => {
				if(user.userId === localId.toString()) {
					user.unread = user.unread - count;
					// user.unread = user.unread - req.body.messagesRead.length;
				}
			});
			
			console.log('Friend userData is ..............................');
			console.log(foundFriend.userData);
			await foundFriend.save();
			if(tempList.length > 0) {
				io.sockets.in(req.params.id).emit('readMessages',tempObj);	
			}
		}
	});
});

app.get('/friendslist', verifyToken, (req,res) => {
	console.log('Entered Friendslist route');
	const idNow = req.authData.foundUser._id;
		Friend.find({userId: idNow}, (err,foundFriends) => {
		if(err) {
			console.log(err);
		} else {
			console.log('friends list is...');
			console.log(foundFriends);
			res.send(foundFriends);
		}
	});
});

app.get('/blogsList', verifyToken, (req,res) => {
	console.log('Entered blogslist route');
	const idNow = req.authData.foundUser._id;
	const listNow12 = [1,2,3];
	res.send(listNow12);
});

app.get('/friendData/:id', verifyToken, (req,res) => {
	Friend.findById(req.params.id).populate('chats').exec((err,foundFriend) => {
		if(err) {
			console.log(err);
		} else {
			console.log('FriendData is ...');
			console.log(foundFriend);
			res.send(foundFriend);
		}
	});
})

app.post('/auth/login',(req,res) => {
	User.findOne({username: req.body.username,
			   email: req.body.email},(err,foundUser) => {
		if(err) {
			console.log(err);
			res.status(400).send('Username and/or email doesnt exist');
		} else {
			console.log(req.body.password);
			console.log(foundUser.email);
			bcrypt.compare(req.body.password, foundUser.password, (err,result) => {
				if(err) {
					console.log('There was an error');
					res.status(400).send('there was an error');
				} else {
					if(result) {
						delete foundUser.password;
						jwt.sign({foundUser},'secretKey',(err,token) => {
							res.send({
								username: foundUser.username,
								idToken: token,
								localId: foundUser._id,
								expiresIn: 3600
							});
						});
					} else {
						console.log('Wrong Password');
						res.status(400).send('Wrong password');
					}
				}
			});
			// if(await bcrypt.compare(req.body.password,foundUser.password)){
			// 	delete foundUser.password;
			// 	jwt.sign({foundUser},'secretKey',(err,token) => {
			// 		res.send({
			// 			username: foundUser.username,
			// 			idToken: token,
			// 			localId: foundUser._id,
			// 			expiresIn: 3600
			// 		});
			// 	});
			// } else {
			// 	res.status(400).send('Wrong password');
			// }
		}
	});
});

app.post('/auth/signup',async (req,res) => {
	// const salt = await bcrypt.genSalt();
	const hashedPassword = await bcrypt.hash(req.body.password, 10);
	const user = {
		username: req.body.username,
		email: req.body.email,
		password: hashedPassword
	}
	console.log(hashedPassword);
	User.create(user, (err,foundUser) => {
		if(err){
			console.log(err)
		} else {
			console.log("User Created");
			delete foundUser.password;
			console.log(foundUser);
			
			jwt.sign({foundUser},'secretKey',(err,token) => {
				res.send({
					username: foundUser.username,
					idToken: token,
					localId: foundUser._id,
					expiresIn: 3600
				});
			});
		}
	});
	
	
	// User.find({}, (err,foundUser) => {
	// 	if(err) {
	// 		console.log(err);
	// 	} else {
	// 		console.log(foundUser);
	// 	}
	// });
	
	
	// console.log(user);
	
	// console.log('Reached the route');
	
	// const user1 = {
	// 	idToken: 'Default1',
	// 	localId: 'Default1',
	// 	expiresIn: 3600
	// }
	
	// res.send(user1);
});

io.on('connection', (client) => {
	client.on("userConnected", userNow => {
		const user = {
			name: userNow.username,
			id: userNow.userId,
			socketId: client.id
		}
		User.findById(user.id).populate('friends').exec((err,foundUser) => {
			if(err){
				console.log(err);
			} else {
				foundUser.clientId.push(user.socketId);
				console.log('connected');
				// console.log(foundUser);
				// cant say if forEach is suitable here
				foundUser.friends.forEach(friend => {
					friend.userData.forEach(userNow => {
						if(userNow.userId === foundUser._id.toString()) {
							userNow.online = foundUser.clientId.length > 0;
						}
					})
					friend.save();
					console.log(friend._id.toString());
					client.join(friend._id.toString());
					io.sockets.in(friend._id.toString()).emit('userStatusUpdate',{
						chatId: friend._id.toString(),
						userId: foundUser._id.toString(),
						status: foundUser.clientId.length > 0
					});
				});
				foundUser.save();
			}
		});
		
		Friend.find({userId: user.id} , (err,foundFriends) => {
			if(err) {
				console.log(err);
			} else {
				console.log('found friends are');
				if(foundFriends != null){
					console.log('Found friends are');
					console.log(foundFriends);
					foundFriends.forEach(item => {
						let indexNow = item.userData[0].userId === user.id ? 0 : 1;
						console.log('index is ...');
						console.log(indexNow);
					});
				}
			}
		});
		// console.log(user);
		users[client.id] = user;
		UserData.push(user);
		// console.log(user);
		// io.emit("connected", user);
		io.emit("users", UserData);
	});
	client.on("send",message => {
		let tempArr = [];
		tempArr.push(message.senderId);
		message.readBy = tempArr;
		console.log(message);
		Friend.findById(message.chatId, (err,foundFriend) => {
			if(err) {
				console.log(err);
			} else {
				console.log(foundFriend);
				Message.create(message,async (err,newMessage) => {
					if(err) {
						console.log(err);
					} else {
						foundFriend.userData.forEach(user => {
							if(user.userId !== message.senderId) {
								user.unread = user.unread + 1;
							}
						});
						foundFriend.chats.push(newMessage);
						await foundFriend.save();
						io.sockets.in(message.chatId).emit('message',newMessage);
					}
				});
			}
		});
		// io.emit("message", message);
	});
	client.on("disconnect", () => {
		User.findOne({clientId: client.id}).populate('friends').exec((err,foundUser) => {
			if(err) {
				console.log(err);
			} else { 
					// foundUser.clientId = '';
				if(foundUser !== null){
					console.log('Reached else');
					    foundUser.clientId = [];
						// foundUser.clientId = foundUser.clientId.filter(item => item != client.id);
						foundUser.friends.forEach(friend => {
							friend.userData.forEach(userNow => {
								if(userNow.userId === foundUser._id.toString()) {
									userNow.online = foundUser.clientId.length > 0;
								}
							})
							friend.save();
							io.sockets.in(friend._id.toString()).emit('userStatusUpdate',{
								chatId: friend._id.toString(),
								userId: foundUser._id.toString(),
								status: foundUser.clientId.length > 0
							});
						});
						console.log('disconnected');
						console.log(foundUser);
						foundUser.save();	
				}
				
					
				
			}
		});
		const username = users[client.id];
    	delete users[client.id];
		UserData = UserData.filter(user => user.socketId != client.id);
    	io.emit("disconnected", client.id);
		io.emit("users", UserData);
	})
});

async function verifyToken(req,res,next) {
	console.log('reached middleware');
	const bearerHeader = req.headers['authorization'];
	if(bearerHeader) {
		const bearer = bearerHeader.split(' ');
		const bearerToken = bearer[1];
		await jwt.verify(bearerToken, 'secretKey', (err,authData) => {
			if(err) {
				res.ssendStatus(403)
			} else {
				req.authData = authData;
			}
		});
		req.token = bearerToken;
		next();
	} else {
		res.sendStatus(401);
	}
}

server.listen(PORT, () => {
	console.log('listening on port 4000');
});