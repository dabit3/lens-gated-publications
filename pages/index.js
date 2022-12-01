import { useEffect, useState } from 'react'
import { ethers } from 'ethers'
import {
  client, challenge, authenticate, getDefaultProfile,
  signCreatePostTypedData, lensHub, splitSignature, validateMetadata, getSigner } from '../api'
import { create } from 'ipfs-http-client'
import { v4 as uuid } from 'uuid'
import { ContractType, LensGatedSDK, LensEnvironment,  } from '@lens-protocol/sdk-gated'

const projectId = process.env.NEXT_PUBLIC_PROJECT_ID
const projectSecret = process.env.NEXT_PUBLIC_PROJECT_SECRET
const auth = 'Basic ' + Buffer.from(projectId + ':' + projectSecret).toString('base64');

const ipfsClient = create({
  host: 'ipfs.infura.io',
  port: 5001,
  protocol: 'https',
  headers: {
      authorization: auth,
  },
})

const nftAccessCondition = {
  contractAddress: '0x25ed58c027921E14D86380eA2646E3a1B5C55A8b',
  chainID: 1,
  contractType: ContractType.Erc721
}

export default function Home() {
  /* local state variables to hold user's address and access token */
  const [address, setAddress] = useState()
  const [token, setToken] = useState()
  const [postData, setPostData] = useState('')
  const [handle, setHandle] = useState('')
  const [profileId, setProfileId] = useState('')

  useEffect(() => {
    /* when the app loads, check to see if the user has already connected their wallet */
    checkConnection()
  }, [])
  async function checkConnection() {
    const provider = new ethers.providers.Web3Provider(window.ethereum)
    const accounts = await provider.listAccounts()
    if (accounts.length) {
      setAddress(accounts[0])
      const response = await client.query({
        query: getDefaultProfile,
        variables: { address: accounts[0] }
      })
      setProfileId(response.data.defaultProfile.id)
      setHandle(response.data.defaultProfile.handle)
    }
  }
  async function connect() {
    /* this allows the user to connect their wallet */
    const account = await window.ethereum.send('eth_requestAccounts')
    if (account.result.length) {
      setAddress(account.result[0])
    }
  }
  async function login() {
    try {
      /* first request the challenge from the API server */
      const challengeInfo = await client.query({
        query: challenge,
        variables: { address }
      })
      const provider = new ethers.providers.Web3Provider(window.ethereum);
      const signer = provider.getSigner()
      /* ask the user to sign a message with the challenge info returned from the server */
      const signature = await signer.signMessage(challengeInfo.data.challenge.text)
      /* authenticate the user */
      const authData = await client.mutate({
        mutation: authenticate,
        variables: {
          address, signature
        }
      })
      /* if user authentication is successful, you will receive an accessToken and refreshToken */
      const { data: { authenticate: { accessToken }}} = authData
      console.log({ accessToken })
      setToken(accessToken)
      window.localStorage.setItem('lens-auth-token', accessToken)
    } catch (err) {
      console.log('Error signing in: ', err)
    }
  }

  async function createPost() {
    if (!postData) return
    const {
      encryptedMetadata, contentURI
    } = await uploadToIPFS()
    console.log({ encryptedMetadata})
    return
    console.log({
      contentURI
    })

    const createPostRequest = {
      profileId,
      contentURI: 'ipfs://' + contentURI.path,
      collectModule: {
        freeCollectModule: { followerOnly: true }
      },
      referenceModule: {
        followerOnlyReferenceModule: false
      },
      gated: {
        nft: nftAccessCondition,
        encryptedSymmetricKey:
          encryptedMetadata.encryptionParams.providerSpecificParams.encryptionKey,
      },
    }
    try {
      const signedResult = await signCreatePostTypedData(createPostRequest, token)
      const typedData = signedResult.result.typedData
      const { v, r, s } = splitSignature(signedResult.signature)
      const tx = await lensHub.postWithSig({
        profileId: typedData.value.profileId,
        contentURI: typedData.value.contentURI,
        collectModule: typedData.value.collectModule,
        collectModuleInitData: typedData.value.collectModuleInitData,
        referenceModule: typedData.value.referenceModule,
        referenceModuleInitData: typedData.value.referenceModuleInitData,
        sig: {
          v,
          r,
          s,
          deadline: typedData.value.deadline,
        },
      })
      console.log('successfully created post: tx hash', tx.hash)
    } catch (err) {
      console.log('error posting publication: ', err)
    }
  }
  async function uploadToIPFS() {
    const metadata = {
      version: '2.0.0',
      content: postData,
      description: "This is a gated post!",
      name: `Post by @${handle}`,
      external_url: `https://lenster.xyz/u/${handle}`,
      metadata_id: uuid(),
      mainContentFocus: 'TEXT_ONLY',
      attributes: [],
      locale: 'en-US',
    }

    const result = await client.query({
      query: validateMetadata,
      variables: {
        metadatav2: metadata
      }
    })
    console.log('Metadata verification request: ', result)

    const sdk = await LensGatedSDK.create({
      provider: new ethers.providers.Web3Provider(window.ethereum),
      signer: getSigner(), //from wagmi or a wallet
      env: LensEnvironment.Polygon,
    })

    const { contentURI, encryptedMetadata } = await sdk.gated.encryptMetadata(
      metadata,
      profileId,
      AccessConditionOutput = {
        
      },
      {
        nft: nftAccessCondition
      },
      async function(EncryptedMetadata) {
        const added = await ipfsClient.add(JSON.stringify(EncryptedMetadata))
        return added
      },
    )

    console.log("contentURI: ", contentURI)
    console.log("encryptedMetadata: ", encryptedMetadata)
  
    return {
      encryptedMetadata, contentURI
    }

    // return added
  }
  function onChange(e) {
    setPostData(e.target.value)
  }

  return (
    <div>
      { /* if the user has not yet connected their wallet, show a connect button */ }
      {
        !address && <button onClick={connect}>Connect</button>
      }
      { /* if the user has connected their wallet but has not yet authenticated, show them a login button */ }
      {
        address && !token && (
          <div onClick={login}>
            <button>Login</button>
          </div>
        )
      }
      { /* once the user has authenticated, show them a success message */ }
      {
        address && token && (
          <div>
              <h2>Successfully signed in!</h2>
              <input
                onChange={onChange}
              />
              <button onClick={createPost}>Submit</button>
          </div>
        )
      }
    </div>
  )
}