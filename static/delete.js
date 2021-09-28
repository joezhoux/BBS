$(function() {
  $('.delete-comment').on('click', async function(e) {
    const commentId = this.dataset.commentId
    console.log('删除评论', commentId)
    if (!confirm('确定要删除吗?')) {
      return
    }
    await $.ajax('/comment/' + commentId, {
      method: 'delete'
    })
    $(this).closest('fieldset').remove()
  })

  $('.delete-post').on('click', async function(e) {
    const postId = this.dataset.postId
    console.log('删除', postId)
    if (!confirm('确定要删除吗?')) {
      return
    }
    await $.ajax('/post/' + postId, {
      method: 'delete'
    })
    location.href = '/'
  })
})