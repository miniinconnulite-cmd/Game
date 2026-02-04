const axios = require('axios')
const qs = require('qs')

async function ytStreamer(query) {
  // 1️⃣ Search video
  const searchRes = await axios.post(
    'https://ssvid.net/api/ajax/search?hl=en',
    qs.stringify({ query }),
    { headers: { 'Content-Type': 'application/x-www-form-urlencoded' } }
  )

  const data = searchRes.data
  if (!data || !data.links) throw new Error('Not_found')

  const vid = data.vid
  const title = data.title
  const qualities = []

  // 2️⃣ Collect MP4 qualities
  if (data.links.mp4) {
    for (const quality of Object.keys(data.links.mp4)) {
      qualities.push({
        quality,
        key: data.links.mp4[quality].k,
        size: data.links.mp4[quality].size || null
      })
    }
  }

  // 3️⃣ Choose preferred video quality
  const preferredQualities = ['137', '136', '18']
  let videoKey = null

  for (const q of preferredQualities) {
    if (data.links.mp4?.[q]?.k) {
      videoKey = data.links.mp4[q].k
      break
    }
  }

  // fallback
  if (!videoKey) {
    for (const q of Object.keys(data.links.mp4 || {})) {
      if (data.links.mp4[q]?.k) {
        videoKey = data.links.mp4[q].k
        break
      }
    }
  }

  // 4️⃣ Choose audio (MP3)
  let audioKey = null
  if (data.links.mp3) {
    const mp3Keys = Object.keys(data.links.mp3)
    const bestMp3 = mp3Keys.find(k => k.includes('128'))

    if (bestMp3) {
      audioKey = data.links.mp3[bestMp3].k
    } else if (mp3Keys.length > 0) {
      audioKey = data.links.mp3[mp3Keys[0]].k
    }
  }

  // 5️⃣ Convert function
  async function convert(k) {
    const res = await axios.post(
      'https://ssvid.net/api/ajax/convert?hl=en',
      qs.stringify({ vid, k }),
      { headers: { 'Content-Type': 'application/x-www-form-urlencoded' } }
    )
    return res.data.dlink || null
  }

  const video = videoKey ? await convert(videoKey) : null
  const audio = audioKey ? await convert(audioKey) : null

  return {
    title,
    qualities,
    video,
    audio,
    videoKey,
    audioKey,
    creator: 'naxordeve'
  }
}

module.exports = ytStreamer