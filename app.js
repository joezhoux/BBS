const express = require('express')
const fs = require('fs')
const cookieParser = require('cookie-parser')

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

app.use(cookieParser('sign secert'))//cookie签名生成密码
app.use(express.static(__dirname + '/static'))
app.use(express.json())
app.use(express.urlencoded())
app.use((req, res, next) =>{
  if (req.signedCookies.loginUser) {
    req.isLogin = true
  } else {
    req.isLogin = false
  }
  next()
})

app.get('/', (req, res, next) => {
  res.set('Content-Type', 'text/html; charset=UTF-8')
  res.end(`
    <h1>BBS</h1>
    <div>
      ${
        req.isLogin ? 
        `
        <a href="/post">发帖</a>
        <a href="/logout">登出</a>
        ` : `
        <a href="/login">登录</a>
        <a href="/register.html">注册</a>
        `
      }
    </div>
    <ul>
      ${
        posts.map(post => {
          return `<li><a href="/post/${post.id}">${post.title}</a></li>`
        }).join('\n')
      }
    </ul>
  `)
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
  let postId = req.params.id
  const postComments = comments.filter(it => it.id == postId)
  let post = posts.find(it => it.id == postId)
  if (post) {
    res.set('Content-Type', 'text/html; charset=UTF-8')
    res.end(`
      <h1>BBS</h1>
      <div>
        ${
          req.isLogin ? 
          `
          <a href="/post">发帖</a>
          <a href="/logout">登出</a>
          ` : `
          <a href="/login">登录</a>
          <a href="/register.html">注册</a>
          `
        }
      </div>
      <h2>${post.title}</h2>
      <fieldset>${post.content}</fieldset>
      <hr>
      ${
        postComments.map(it => {
          return `
            <fieldset>
              <legend>${it.commentBy}</legend>
              <p>${it.content}</p>
            </fieldset>
          `
        }).join('\n')
      }
      ${
        req.isLogin ? 
        `
          <form action="/comment/post/${postId}" method="POST">
          <h3>发表评论</h3>
          <textarea name="content" cols="30" rows="10"></textarea>
          <div><button>开始对线</button></div>
          </form>
        ` : `
          <p>想对线？先<a href="/login">登录</a></p>
        `
      }

    `)
  } else {
    res.end('404 无法找到此贴')
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
