import { useEffect, useState } from 'react'
import {
  client, getDefaultProfile, getPublication, getSigner } from '../api'
import { ethers } from 'ethers'
import { LensGatedSDK, LensEnvironment } from '@lens-protocol/sdk-gated'
import { css } from '@emotion/css'

export default function Feed() {
  const [post, setPost] = useState()
  const [loading, setLoading] = useState(false)
  const [publicationId, setPublicationId] = useState('')
  const [profileId, setProfileId] = useState('')
  const [message, setMessage] = useState('')
  useEffect(() => {
    checkConnection()
  }, [])
  async function checkConnection() {
    const provider = new ethers.providers.Web3Provider(window.ethereum)
    const accounts = await provider.listAccounts()
    if (accounts.length) {
      /* if the user's wallet is connected, call the API and get the user's profile information */
      try {
        const response = await client.query({
          query: getDefaultProfile,
          variables: {
            address: accounts[0],
            limit: 50
          }
        })
        console.log({accounts })
        setProfileId(response.data.defaultProfile.id)
      } catch (err) {
        console.log('error fetching profile... ', err)
        setMessage('error: user does not have a Lens profile')
      }
    }
  }
  async function decryptPost() {
    setMessage('')
    setPost()
    setLoading(true)
    try {
      /* here we call the API using the signed in user's profile ID to get the individual post */
      const result = await client.query({
        query: getPublication,
        variables: {
          publicationId,
          profileId
        }
      })
      let post = result.data.publication

      /* if the user is unable to decrypt, set the message in the local state and return from the function */
      if (!post.canDecrypt.result) {
        setMessage('You are unable to view this post.')
        setLoading(false)
        return
      }

      try {
        /* next, we create an instance of the Lens SDK */
        const sdk = await LensGatedSDK.create({
          provider: new ethers.providers.Web3Provider(window.ethereum),
          signer: getSigner(),
          env: process.env.NEXT_PUBLIC_ENVIRONMENT || LensEnvironment.Mumbai,
        })

        /* we then use the Lens SDK to decrypt the message */
        const { decrypted } = await sdk.gated.decryptMetadata(post.metadata)
        console.log({ decrypted })
        setPost(decrypted)
      } catch (err) {
        console.log('error decrypting post... ', err)
      }
      setLoading(false)
    } catch (err) {
      console.log("Error fetching posts...", err)
    }
  }
  return (
    <div className={contentContainerStyle}>
      <h1>Decrypt an individual publication</h1>
      <input
        onChange={e => setPublicationId(e.target.value)}
        placeholder="ID of post"
        value={publicationId}
        className={inputStyle}
      />
      <button className={submitButtonStyle} onClick={decryptPost}>Decrypt Post</button>
      {
        post && (
          <div>
            <h3>Decrypted post</h3>
            <p>{post.content}</p>
          </div>
        )
      }
      { message && <p>{message}</p> }
      { loading && <p>Loading and decrypting post ...</p>}
    </div>
  )
}

const contentContainerStyle = css`
  display: flex;
  flex-direction: column;
  align-items: flex-start;
`

const inputStyle = css`
  outline: none;
  border: 1px solid rgba(0, 0, 0, .25);
  padding: 9px 15px;
  border-radius: 25px;
  width: 320px;
  margin-bottom: 5px;
  margin-left: 4px;
`

const submitButtonStyle = css`
  border: none;
  outline: none;
  padding: 13px 35px;
  border-radius: 35px;
  margin-right: 6px;
  cursor: pointer;
  font-weight: 800;
  color: white;
  background-color: #1976d2;
  text-shadow: 1px 1px 2px rgba(0, 0, 0, .2);
  margin-top: 15px;
`
