import { useEffect, useState } from 'react'
import {
  client, getDefaultProfile, getPublications, getSigner } from '../api'
import { ethers } from 'ethers'
import {  LensGatedSDK, LensEnvironment,  } from '@lens-protocol/sdk-gated'

export default function Feed() {
  const [posts, setPosts] = useState([])
  useEffect(() => {
    checkConnection()
  }, [])
  async function checkConnection() {
    const provider = new ethers.providers.Web3Provider(window.ethereum)
    const accounts = await provider.listAccounts()
    if (accounts.length) {
      const response = await client.query({
        query: getDefaultProfile,
        variables: { address: accounts[0] }
      })
      fetchPosts(response.data.defaultProfile.id)
    }
  }
  async function fetchPosts(profileId) {
    try {
      console.log('calling API')

      const result = await client.query({
        query: getPublications,
        variables: {
          profileId
        }
      })
      let posts = result.data.publications.items
      posts = posts.filter(post => post.canDecrypt && post.canDecrypt.result)

      const sdk = await LensGatedSDK.create({
        provider: new ethers.providers.Web3Provider(window.ethereum),
        signer: getSigner(), //from wagmi or a wallet
        env: LensEnvironment.Polygon,
      })
      
      posts = await Promise.all(posts.map(async post => {
        try {
          const { decrypted } = await sdk.gated.decryptMetadata(post.metadata)
          return decrypted
        } catch (err) {
          console.log('error decrypting: ', err)
          return null
        }
      }))

      console.log({ posts })
          
      setPosts(posts)
    } catch (err) {
      console.log("Error fetching posts...", err)
    }
  }
  return (
    <div>
      <h1>Gated Posts</h1>
      {
        posts.map((post, index) => (
          <div key={index}>
            <h2>{post.content}</h2>
          </div>
        ))
      }
    </div>
  )
}