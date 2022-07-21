import path from 'path'
import http from 'http'
import Express from 'express'
import socketio from 'socket.io'
import mongoose from 'mongoose'
import User from '../src/models/User'
import livereload from 'livereload'
import connectLiveReload from 'connect-livereload'
import session from 'express-session'
import 'dotenv/config'

const liveReloadServer = livereload.createServer();
  liveReloadServer.server.once("connection", () => {
    setTimeout(() => {
      liveReloadServer.refresh("/");
    }, 100);
})

const app = Express()
const server = http.createServer(app)
const io = socketio(server)
const port = process.env.PORT || 3000

mongoose.connect(`mongodb+srv://${process.env.DB_USER}:${process.env.DB_PASSWORD}@apicluster.kbp4k.mongodb.net/?retryWrites=true&w=majority`)
.then(() => console.log('Banco conectado!'))
.catch((err) => console.log('Erro ao conectar ao banco' + err))

app.use(session({
	secret: 'cat',
	resave: false,
	saveUninitialized: false,
}))
app.use(connectLiveReload())
app.use(Express.static(path.join(__dirname, 'public')))

let onlineUsers = 0

io.on('connection', socket => {
	let addedUser = false

  socket.on('loginUser', data => {
    const {email, password} = data

    let errors = []

    if(!email){
      errors.push('Usuário inválido')
    }
    if(!password){
      errors.push('Senha inválido')
    }

    if(errors.length > 1){
      return console.log(errors)
    } else{
      User.findOne({email: email, password: password})
      .then((user) => {
        if(!user){
          return console.log('Senha/Usuário inválidos, por favor digite novamente.')
        } else {
          console.log('Logado com sucesso!')
          if (addedUser) return
		
          socket.username = user.name
          ++onlineUsers
          addedUser = true
          
          socket.emit('validUser', user.name)

          socket.emit('login', {
            onlineUsers
          })
          
          socket.broadcast.emit('userJoined', {
            username: user.name,
            onlineUsers
          })
          
          console.log(`User ${user.name} added`)
        }
      })
      .catch((err) => console.log('Houve um erro interno' + err))
    }
  })

  socket.on('newUser', data => {    
    const {username, email, password} = data

    let errors = []

    if(!username){
      errors.push('Usuário inválido')
    }
    if(!email){
      errors.push('E-mail inválido')
    }
    if(!password){
      errors.push('Senha inválido')
    }

    if(errors.length > 1){
      return console.log(errors);
    } else {
      User.findOne({email: email})
      .then((user) => {
        if(user){
          console.log('Já existe um usuário com este e-mail')
          return
        }
        const newUser = new User ({
          name: username,
          email: email,
          password: password
        })
        newUser.save()
        .then(() => {
          console.log('Registado com sucesso!')
          socket.emit('sucessRegister')
        })
        .catch((err) => console.log('Erro ao registrar o usuário' + err))
      })
      .catch((err) => console.log('Houve um erro interno' + err))
    }
    
  })

	socket.on('newMessage', data => {
		socket.broadcast.emit('newMessage', {
			username: socket.username,
			message: data
		});
		
		console.log('New message', data)
	})
	
	socket.on('typing', () => {
		socket.broadcast.emit('typing', {
			username: socket.username
		})
	})
	
	socket.on('stopTyping', () => {
		socket.broadcast.emit('stopTyping', {
			username: socket.username
		})
	})
	
	socket.on('disconnect', () => {
		if (addedUser) {
			--onlineUsers
			
			socket.broadcast.emit('userLeft', {
				username: socket.username,
				onlineUsers
			})
		}
	})
})

server.listen(port, () => {
	console.log('Server listening at port %d', port)
})
