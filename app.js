const express = require('express')
const fs = require('fs')
const cookieParser = require('cookie-parser')
const escape = require('lodash/escape') // 转译无意义的标签<>为实体减少xss的可能

const app = express()

const port = 8000

const users = loadFile('./users.json')
const posts = loadFile('./posts.json')
const comments = loadFile('./comments.json')

function loadFile(file) {
  try {
    let content = fs.readFileSync(file)
    return JSON.parse(content)
  } catch(e) {
    return []
  }
}

setInterval(() => {
  fs.writeFileSync('./users.json', JSON.stringify(users, null, 2))//格式化缩进2
  fs.writeFileSync('./posts.json', JSON.stringify(posts, null, 2))
  fs.writeFileSync('./comments.json', JSON.stringify(comments, null, 2))
  console.log('saved')
}, 5000)


app.set('views', __dirname + '/templates')
app.locals.pretty = true //pug输出格式化过的html

app.use(cookieParser('sign secert'))//cookie签名生成密码
app.use(express.static(__dirname + '/static'))
app.use(express.json())
app.use(express.urlencoded())
app.use((req, res, next) =>{
  //判断用户是否在登录状态
  if (req.signedCookies.loginUser) {
    req.isLogin = true
  } else {
    req.isLogin = false
  }
  next()
})

app.get('/', (req, res, next) => {
  res.set('Content-Type', 'text/html; charset=UTF-8')
  const page = Number(req.query.page || 1)
  const pageSize = 10
  const startIdx = (page - 1) * pageSize
  const endIdx = startIdx + pageSize
  const pagePosts = posts.slice(startIdx, endIdx)
  if (pagePosts.length == 0) {
    res.render('404.pug')
    return
  }
  res.render('home.pug', {
    isLogin: req.isLogin,
    pagePosts: pagePosts,
    page: page,
    loginUser: 'aaa'
  })
})

app.route('/post')
.get((req, res, next) => {
  res.sendFile(__dirname + '/static/post.html')
})
.post((req, res, next) => {
  res.set('Content-Type', 'text/html; charset=UTF-8')
  const postInfo = req.body
  const userName = req.signedCookies.loginUser
  if (userName) {
    postInfo.timestamp = new Date().toISOString()
    postInfo.id = posts.length
    postInfo.postedBy = userName
    posts.push(postInfo)
    res.redirect('/post/' + postInfo.id)
  } else {
    res.end('未登录，请先登录')
  }

})

app.get('/post/:id', (req, res, next) => {
  const postId = req.params.id
  const post = posts.find(it => it.id == postId)
  if (post) {
    res.set('Content-Type', 'text/html; charset=UTF-8')
    const postComments = comments.filter(it => it.id == postId)
    res.render('post.pug', {
      isLogin: req.isLogin,
      post: post,
      postComments: postComments,
      postId: postId
    })
  } else {
    res.render('404.pug')
  }
})

app.post('/comment/post/:id', (req, res, next) => {
  if (req.isLogin) {
    const comment = req.body
    comment.timestamp = new Date().toISOString()
    comment.id = req.params.id
    comment.commentBy = req.signedCookies.loginUser
    comments.push(comment)
    res.redirect(req.headers.referer || '/')
  } else {
    res.end('请登录')
  }
})

app.route('/register')
.get((req, res, next) => {
  res.sendFile(__dirname + '/static/register.html')
})
.post((req, res, next) => {
  res.set('Content-Type', 'text/html; charset=UTF-8')
  const regInfo = req.body
  //检测用户名合法性
  const USERNAME_RE = /^[0-9a-z_]+$/i
  if (!USERNAME_RE.test(regInfo.name)) {
    res.status(400).end('用户名只能由数字、字母以及下划线组成')
  } else if (users.some(it => it.name == regInfo.name)) {
    res.status(400).end('用户名已被占用')
  } else if (users.some(it => it.email == regInfo.email)) {
    res.status(400).end('邮箱已被占用')
  } else if (regInfo.password) {

  } else {
    regInfo.id = users.length
    users.push(regInfo)
    res.end('注册中')
  }
})

app.route('/login')
.get((req, res, next) => {
  res.set('Content-Type', 'text/html; charset=UTF-8')
  res.end(`
    <h1>登录页</h1>
    <form action="/login" method="POST">
      <div>用户名: <input type="text" name="name"></div>
      <div>密码: <input type="password" name="password"></div>
      <input hidden name="return_to" value="${req.headers.referer || '/'}">
      <button>登录</button>
    </form>
  `)
})
.post((req, res, next) => {
  res.set('Content-Type', 'text/html; charset=UTF-8')
  const loginInfo = req.body
  const user = users.find(it => it.name == loginInfo.name && it.password == loginInfo.password)
  if (user) {
    //给cookie颁发签名 
    res.cookie('loginUser', user.name, {
      signed: true
    })
    res.end('登录成功')
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
