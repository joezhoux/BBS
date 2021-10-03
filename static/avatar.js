$('[type="file"]').on('change', async function(e) {
  const file = this.files[0] 
  const fd = new FormData()
  fd.append('file', file)

  const data = await $.ajax('/upload', {
    method: 'post',
    data: fd,
    processData: false,
    contentType: false
  })
  console.log(data)
  $('[type="hidden"]').val(data[0])
})
