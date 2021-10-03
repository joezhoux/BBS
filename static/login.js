$(function() {
  $('#refresh').on('click', async function(e) {
    const img = $('img')
    const url = $('img').attr('src')
    await $.ajax('/captcha-img', {
      method: 'get'
    })
    img.attr('src', url)
  })
})
