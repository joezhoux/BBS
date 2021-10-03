const express = require('express')
const fs = require('fs')
const cookieParser = require('cookie-parser')
const Database = require('better-sqlite3')
const multer  = require('multer')
const path = require('path')
const svgCaptcha = require('svg-captcha')

const storage = multer.diskStorage({
  destination: function (req, res, cb) {
    cb(null, __dirname + '/db/uploads')
  },
  filename: function (req, file, cb) {
    cb(null, Date.now() + '-' + Math.random().toString(16).slice(2) + path.extname(file.originalname))
  }
})
const upload = multer({ storage: storage })

const db = new Database(__dirname + '/db/bbs.db')

const app = express()

const port = 8000

app.set('views', __dirname + '/templates')
app.locals.pretty = true //pug输出格式化过的html

app.use(cookieParser('sign secert'))//cookie签名生成密码
app.use(express.static(__dirname + '/static'))
app.use(express.json())
app.use(express.urlencoded())
app.use('/uploads', express.static(__dirname + '/db/uploads'))

app.use((req, res, next) =>{
  //判断用户是否在登录状态
  if (req.signedCookies.loginUser) {
    const name = req.signedCookies.loginUser
    req.isLogin = true
    req.loginUser = db.prepare('SELECT * FROM users WHERE name = ?').get(name)
  } else {
    req.isLogin = false
    req.loginUser = null
  }
  next()
})

//session
const sessions = {}

setInterval(() => {
  console.log(sessions)
}, 5000)


app.use(function session(req, res, next) {
  if (!req.cookies.sessionId) {
    const sessionId = Math.random().toString(16).slice(2)
    res.cookie('sessionId', sessionId)
    sessions[sessionId] = {}
    req.session = sessions[sessionId]
  } else {
    if (!sessions[req.cookies.sessionId]) {
      sessions[req.cookies.sessionId] = {}
    }
    req.session = sessions[req.cookies.sessionId]
  }
  next()
})

app.get('/', (req, res, next) => {
  const page = Number(req.query.page || 1)
  const pageSize = 10
  const totalPost = db.prepare('SELECT count(*) AS total FROM posts').get().total
  const totalPage = Math.ceil(totalPost / pageSize)
  const offset = (page - 1) * pageSize
  const pagePosts = db.prepare('SELECT * FROM posts JOIN users ON posts.userId = users.userId LIMIT ? OFFSET ?').all(pageSize, offset)
  if (pagePosts.length == 0) {
    res.render('404.pug')
    return
  }
  res.render('home.pug', {
    isLogin: req.isLogin,
    posts: pagePosts,
    page: page,
    totalPage: totalPage,
    loginUser: req.loginUser
  })
})

app.route('/post')
.get((req, res, next) => {
  res.render('issue-post.pug', {
    isLogin: req.isLogin,
    loginUser: req.loginUser
  })   
})
.post((req, res, next) => {
  const postInfo = req.body
  const userName = req.signedCookies.loginUser
  if (userName) {
    const user = db.prepare('SELECT * FROM users WHERE name = ?').get(userName)
    postInfo.timestamp = new Date().toISOString()
    postInfo.userId = user.userId
    const result = db.prepare('INSERT INTO posts (title, content, userId, timestamp) VALUES (?, ?, ?, ?)')
      .run(postInfo.title, postInfo.content, postInfo.userId, postInfo.timestamp)
    res.redirect('/post/' + result.lastInsertRowid)
  } else {
    res.end('未登录，请先登录')
  }
})

app.get('/post/:id', (req, res, next) => {
  const postId = req.params.id
  const post = db.prepare('SELECT * FROM posts JOIN users ON posts.userId = users.userId WHERE postId = ?').get(postId)
  if (post) {
    const comments = db.prepare('SELECT * FROM comments JOIN users ON comments.userId = users.userId WHERE postId = ?').all(postId)
    res.render('post.pug', {
      isLogin: req.isLogin,
      post: post,
      comments: comments,
      loginUser: req.loginUser
    })
  } else {
    res.render('404.pug')
  }
})

app.post('/comment/post/:id', (req, res, next) => {
  if (req.isLogin) {
    const comment = req.body
    const user = req.loginUser
    comment.timestamp = new Date().toISOString()
    comment.postId = req.params.id
    comment.userId = user.userId

    const result = db.prepare('INSERT INTO comments (content, postId, userId, timestamp) VALUES (?, ?, ?, ?)')
      .run(comment.content, comment.postId, comment.userId, comment.timestamp)

    res.redirect(req.headers.referer || '/')
  } else {
    res.redirect('/login')
  }
})

app.route('/register')
.get((req, res, next) => {
  res.render('register.pug')
})
.post((req, res, next) => {
  const regInfo = req.body
  //检测用户名合法性
  const USERNAME_RE = /^[0-9a-z_]+$/i
  if (!USERNAME_RE.test(regInfo.name)) {
    res.status(400).end('用户名只能由数字、字母以及下划线组成')
  } else if (regInfo.password == 0) {
    res.status(400).end('密码不能为空')
  } else {
    const addUser = db.prepare('INSERT INTO users (name, password, email, avatar) VALUES (?, ?, ?, ?)')
    const result = addUser.run(regInfo.name, regInfo.password, regInfo.email, regInfo.avatar)
    res.render('register-success.pug')
  }
})

//验证码
app.get('/captcha-img', (req, res, next) => {
  const captcha = svgCaptcha.create({
    color: true,
  })
  req.session.captcha = captcha.text
  res.type('svg')
  res.status(200).send(captcha.data) 
})

app.route('/login')
.get((req, res, next) => {
  res.render('login.pug', {
    url: req.headers.referer
  })
})
.post((req, res, next) => {
  res.header("Content-Type", "application/json; charset=utf-8")
  const loginInfo = req.body
  if (loginInfo.captcha !== req.session.captcha) {
    res.end('验证码错误')
    return
  }
  const userStmt = db.prepare('SELECT * FROM users WHERE name = ? AND password = ?')
  const user = userStmt.get(loginInfo.name, loginInfo.password)
  if (user) {
    //给cookie颁发签名 
    res.cookie('loginUser', user.name, {
      signed: true
    })
    res.redirect('/')
  } else {
    res.status(400).end('用户名或密码错误')
  }
})


app.get('/logout', (req, res, next) => {
  res.clearCookie('loginUser')
  res.redirect(req.headers.referer || '/')
})

//删除评论 帖子
app.delete('/comment/:id', (req, res, next) => {
  const userId = db.prepare('SELECT * FROM comments JOIN users ON comments.userId = users.userId').get().userId
  if (req.loginUser.userId !== userId) {
    res.status(401).json({
      code: -1,
      msg: '删除失败，这不是你的评论'
    })
    return
  }
  db.prepare('DELETE FROM comments WHERE commentId = ?').run(req.params.id)
  res.json({
    code: 0,
    msg: '删除成功'
  })
})

app.delete('/post/:id', (req, res, next) => {
  const userId = db.prepare('SELECT * FROM posts JOIN users ON posts.userId = users.userId').get().userId
  if (req.loginUser.userId !== userId) {
    res.status(401).json({
      code: -1,
      msg: '删除失败，这不是你的帖子'
    })
    return
  }
  db.prepare('DELETE FROM posts WHERE postId = ?').run(req.params.id)
  db.prepare('DELETE FROM comments WHERE postId = ?').run(req.params.id)
  res.json({
    code: 0,
    msg: '删除成功'
  })
})

//上传头像

app.post('/upload', upload.any(), (req, res, next) => {
  const files = req.files
  console.log(files)
  const urls = files.map(file => `http://localhost:8000/uploads/` + file.filename)
  res.json(urls)
})

app.listen(port, () => {
  console.log(`http://localhost:${port}`)
})
