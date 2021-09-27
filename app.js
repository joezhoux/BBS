const express = require('express')
const fs = require('fs')
const cookieParser = require('cookie-parser')
const escape = require('lodash/escape') // 转译无意义的标签<>为实体减少xss的可能
const Database = require('better-sqlite3')

const db = new Database(__dirname + '/db/bbs.db')

const app = express()

const port = 8000

app.set('views', __dirname + '/templates')
app.locals.pretty = true //pug输出格式化过的html

app.use(cookieParser('sign secert'))//cookie签名生成密码
app.use(express.static(__dirname + '/static'))
app.use(express.json())
app.use(express.urlencoded())

app.use((req, res, next) =>{
  //判断用户是否在登录状态
  if (req.signedCookies.loginUser) {
    const name = req.signedCookies.loginUser
    req.isLogin = true
    req.loginUser = db.prepare('select * from users where name = ?').get(name)
  } else {
    req.isLogin = false
    req.loginUser = null
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
    const user = db.prepare('select * from users where name = ?').get(userName)
    postInfo.timestamp = new Date().toISOString()
    postInfo.userId = user.userId
    const result = db.prepare('insert into posts (title, content, userId, timestamp) values (?, ?, ?, ?)')
      .run(postInfo.title, postInfo.content, postInfo.userId, postInfo.timestamp)
    res.redirect('/post/' + result.lastInsertRowid)
  } else {
    res.end('未登录，请先登录')
  }

})

app.get('/post/:id', (req, res, next) => {
  const postId = req.params.id
  const post = db.prepare('select * from posts join users on posts.userId = users.userId where postId = ?').get(postId)
  if (post) {
    const comments = db.prepare('select * from comments join users on comments.userId = users.userId where postId = ?').all(postId)
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

    const result = db.prepare('insert into comments (content, postId, userId, timestamp) values (?, ?, ?, ?)')
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
  res.set('Content-Type', 'text/html; charset=UTF-8')
  const regInfo = req.body
  //检测用户名合法性
  const USERNAME_RE = /^[0-9a-z_]+$/i
  if (!USERNAME_RE.test(regInfo.name)) {
    res.status(400).end('用户名只能由数字、字母以及下划线组成')
  } else if (regInfo.password == 0) {
    res.status(400).end('密码不能为空')
  } else {
    const addUser = db.prepare('insert into users (name, password, email) values (?, ?, ?)')
    const result = addUser.run(regInfo.name, regInfo.password, regInfo.email)
    res.render('register-success.pug')
  }
})

app.route('/login')
.get((req, res, next) => {
  res.set('Content-Type', 'text/html; charset=UTF-8')
  res.render('login.pug', {
    url: req.headers.referer
  })
})
.post((req, res, next) => {
  res.set('Content-Type', 'text/html; charset=UTF-8')
  const loginInfo = req.body
  const userStmt = db.prepare('select * from users where name = ? and password = ?')
  const user = userStmt.get(loginInfo.name, loginInfo.password)
  if (user) {
    //给cookie颁发签名 
    res.cookie('loginUser', user.name, {
      signed: true
    })
    res.redirect(loginInfo.return_to || '/')
  } else {
    res.status(400).end('用户名或密码错误')
  }
})

app.get('/logout', (req, res, next) => {
  res.clearCookie('loginUser')
  res.redirect(req.headers.referer || '/')
})

app.listen(port, () => {
  console.log(`http://localhost:${port}`)
})
