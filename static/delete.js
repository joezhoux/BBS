$(function() {
  $('.delete-comment').on('click', async function(e) {
    const commentId = this.dataset.commentId
    console.log('删除评论', commentId)
  })
})