import { useEffect, useState } from 'react'
import {
  client, getDefaultProfile, getPublications, getSigner } from '../api'
import { ethers } from 'ethers'
import { LensGatedSDK, LensEnvironment } from '@lens-protocol/sdk-gated'
import { css } from '@emotion/css'

export default function Feed() {
  const [posts, setPosts] = useState([])
  const [loading, setLoading] = useState(false)
  useEffect(() => {
    checkConnection()
  }, [])
  async function checkConnection() {
    const provider = new ethers.providers.Web3Provider(window.ethereum)
    const accounts = await provider.listAccounts()
    if (accounts.length) {
      /* if the user's wallet is connected, call the API and get the user's profile information */
      const response = await client.query({
        query: getDefaultProfile,
        variables: {
          address: accounts[0],
          limit: 50
        }
      })
      fetchPosts(response.data.defaultProfile.id)
    }
  }
  async function fetchPosts(profileId) {
    setLoading(true)
    try {
      /* here we call the API using the signed in user's profile ID to get posts created by this user */
      const result = await client.query({
        query: getPublications,
        variables: {
          profileId
        }
      })
      let posts = result.data.publications.items
      /* next we filter to only the posts that can be decrypted */
      posts = posts.filter(post => post.canDecrypt && post.canDecrypt.result)

      /* next, we create an instance of the Lens SDK signing with  */
      const sdk = await LensGatedSDK.create({
        provider: new ethers.providers.Web3Provider(window.ethereum),
        signer: getSigner(),
        env: process.env.NEXT_PUBLIC_ENVIRONMENT || LensEnvironment.Mumbai,
      })

      posts = await Promise.all(posts.map(async post => {
        try {
          const { decrypted } = await sdk.gated.decryptMetadata(post.metadata)
          decrypted.id = post.id
          return decrypted
        } catch (err) {
          console.log('error decrypting: ', err)
          return null
        }
      }))
          
      setPosts(posts)
      setLoading(false)
    } catch (err) {
      console.log("Error fetching posts...", err)
    }
  }

  console.log({ posts })

  return (
    <div>
      <h1>Gated publications viewable by signed in user</h1>
      { loading && <p>Loading and decrypting posts ...</p>}
      {
        posts.map((post, index) => (
          <div className={postContainerStyle} key={index}>
            <p>{post.content}</p>
            <p>Post ID: {post.id}</p>
          </div>
        ))
      }
    </div>
  )
}

const postContainerStyle = css`
  border-bottom: 1px solid rgba(0, 0, 0, .14);
`