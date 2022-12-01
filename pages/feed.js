import { useEffect, useState } from 'react'
import {
  client, challenge, authenticate, getDefaultProfile, getPublications,
  signCreatePostTypedData, lensHub, splitSignature, validateMetadata, getSigner } from '../api'
import { ethers } from 'ethers'
import { ContractType, LensGatedSDK, LensEnvironment,  } from '@lens-protocol/sdk-gated'

export default function Feed() {
  const [posts, gatedPosts] = useState([])
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
      console.log({ posts })
      const sdk = await LensGatedSDK.create({
        provider: new ethers.providers.Web3Provider(window.ethereum),
        signer: getSigner(), //from wagmi or a wallet
        env: LensEnvironment.Polygon,
      })

      console.log("METADATA: ", posts[0].metadata)
      
      let meta = { ...posts[0].metadata }
      // meta.encryptionParams = {...meta.encryptionParams }
      // meta.encryptionParams.accessCondition = { ...meta.encryptionParams.accessCondition }
      // meta.encryptionParams.accessCondition.or = { ...meta.encryptionParams.accessCondition.or }
      // meta.encryptionParams.accessCondition.or = {
      //   criteria: {
      //     ...meta.encryptionParams.accessCondition.or.criteria
      //   }
      // }

      // delete meta.encryptionParams.accessCondition['__typename']

      // delete meta.encryptionParams.accessCondition.or.criteria[0]['nft']
      // delete meta.encryptionParams.accessCondition.or.criteria[0]['__typename']
      // delete meta.encryptionParams.accessCondition.or.criteria[1]['profile']
      // delete meta.encryptionParams.accessCondition.or.criteria[1]['__typename']
      console.log("META 2: ", meta)
      
      const { error, decrypted } = await sdk.gated.decryptMetadata(meta)

      console.log("decrypted: ", decrypted)
      console.log("error: ", error)
    } catch (err) {
      console.log("Error fetching posts...", err)
    }
  }
  return (
    <div>
      <h1>Posts</h1>
    </div>
  )
}