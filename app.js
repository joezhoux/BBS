const express = require('express')


const app = express()

const port = 8000

app.use(express.json())
app.use(express.urlencoded())

app.get('/', (req, res, next) => {
  res.set('Content-Type', 'text/html; charset=UTF-8')
  res.end(`
    <h1>BBS</h1>
    <div>
      <a href="/login">登录</a>
      <a href="/register">注册</a>
    </div>
  `)
})

app.listen(port, () => {
  console.log(`http://localhost:${port}`)
})
