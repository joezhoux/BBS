$('[type="file"]').on('change', async function(e) {
  const file = this.files[0] 
  const xhr = new XMLHttpRequest()
  const fd = new FormData()
  fd.append('file', file)
  xhr.open('post','/upload')
  xhr.send(fd)
  xhr.onload = function() {
    console.log(xhr.responseText)
    const urls = JSON.parse(xhr.responseText)
    const url = urls[0]
    $('[name="avatar"]').val(url)
  }
})
