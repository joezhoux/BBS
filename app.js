const express = require('express')
const fs = require('fs')

const app = express()

const port = 8000

const users = loadFile('./users.json')
const posts = loadFile('./posts.json')

function loadFile(file) {
  try {
    let content = fs.readFileSync(file)
    return JSON.parse(content)
  } catch(e) {
    return []
  }
}

setInterval(() => {
  fs.writeFileSync('./users.json', JSON.stringify(users, null, 2))
  fs.writeFileSync('./posts.json', JSON.stringify(posts, null, 2))
  console.log('saved')
}, 5000)


app.use(express.static(__dirname + '/static'))
app.use(express.json())
app.use(express.urlencoded())

app.get('/', (req, res, next) => {
  res.set('Content-Type', 'text/html; charset=UTF-8')
  res.end(`
    <h1>BBS</h1>
    <div>
      <a href="/login">登录</a>
      <a href="/register.html">注册</a>
    </div>
  `)
})

app.route('/post')
.get((req, res, next) => {
  res.sendFile(__dirname + '/static/post.html')
})
.post((req, res, next) => {
  res.set('Content-Type', 'text/html; charset=UTF-8')
  const postInfo = req.body
  postInfo.timestamp = new Date().toISOString()
  postInfo.id = posts.length
  posts.push(postInfo)
  res.end('发帖成功: ' + postInfo.id)
})

app.get('/post/:id', (req, res, next) => {
  let postId = req.params.id
  let post = posts.find(it => it.id == postId)
  if (post) {
    res.set('Content-Type', 'text/html; charset=UTF-8')
    console.log('111111')
    res.end(`
      <h1>${post.title}</h1>
      <fieldset>${post.content}</fieldset>
    `)
  } else {
    res.end('404 无法找到此贴')
  }
})

app.route('/register')
.get((req, res, next) => {
  res.sendFile(__dirname + '/static/register.html')
})
.post((req, res, next) => {
  res.set('Content-Type', 'text/html; charset=UTF-8')
  const regInfo = req.body
  if (users.some(it => it.name == regInfo.name)) {
    res.status(400).end('用户名已被占用')
  } else if (users.some(it => it.email == regInfo.email)) {
    res.status(400).end('邮箱已被占用')
  } else {
    regInfo.id = users.length
    users.push(regInfo)
    res.end('注册中')
  }
})

app.route('/login')
.get((req, res, next) => {
  res.sendFile(__dirname + '/static/login.html')
})
.post((req, res, next) => {
  res.set('Content-Type', 'text/html; charset=UTF-8')
  const loginInfo = req.body
  if (users.find(it => it.name == loginInfo.name && it.password == loginInfo.password)) {
    res.end('登录成功')
  } else {
    res.status(400).end('用户名或密码错误')
  }
})

app.listen(port, () => {
  console.log(`http://localhost:${port}`)
})
