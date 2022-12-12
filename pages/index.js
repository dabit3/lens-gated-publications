import { useEffect, useState } from 'react'
import { ethers } from 'ethers'
import {
  client, challenge, authenticate, getDefaultProfile, refreshAuthToken,
  signCreatePostTypedData, lensHub, splitSignature, validateMetadata,
  getSigner, STORAGE_KEY
} from '../api'
import { create } from 'ipfs-http-client'
import { v4 as uuid } from 'uuid'
import { ContractType, LensGatedSDK, LensEnvironment,  } from '@lens-protocol/sdk-gated'
import { css } from '@emotion/css'

const projectId = process.env.NEXT_PUBLIC_PROJECT_ID
const projectSecret = process.env.NEXT_PUBLIC_PROJECT_SECRET
const auth = 'Basic ' + Buffer.from(projectId + ':' + projectSecret).toString('base64')

const ipfsClient = create({
  host: 'ipfs.infura.io',
  port: 5001,
  protocol: 'https',
  headers: {
      authorization: auth,
  }
})

export default function Home() {
  /* local state variables to hold user's address and access token */
  const [address, setAddress] = useState()
  const [token, setToken] = useState()
  const [postData, setPostData] = useState('')
  const [handle, setHandle] = useState('')
  const [profileId, setProfileId] = useState('')
  const [gatingType, setGatingType] = useState('nft')
  const [chainID, setChainID] = useState(1)
  const [contractAddress, setContractAddress] = useState()

  let accessCondition = {
    contractAddress,
    chainID
  }

  useEffect(() => {
    /* when the app loads, check to see if the user has already connected their wallet */
    checkConnection()
  }, [])
  async function checkConnection() {
    const token = JSON.parse(window.localStorage.getItem(STORAGE_KEY))
    if (token && token.accessToken) {
      setToken(token.accessToken)
    }
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
      const token = await refreshAuthToken()

      if (token && token.accessToken) {
        setToken(token.accessToken)
      }
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
      const { data: { authenticate: authTokens }} = authData
      setToken(authTokens.accessToken)
      window.localStorage.setItem(STORAGE_KEY, JSON.stringify(authTokens))
    } catch (err) {
      console.log('Error signing in: ', err)
    }
  }

  async function createPost() {
    if (!postData) return
    const {
      encryptedMetadata, contentURI
    } = await uploadToIPFS()

    let gated = {
      encryptedSymmetricKey: encryptedMetadata.encryptionParams.providerSpecificParams.encryptionKey,
    }

    if (gatingType === 'nft') {
      accessCondition.contractType = ContractType.Erc721
      gated.nft = accessCondition
    } else {
      accessCondition.contractType = ContractType.Erc20
      gated.Erc20 = accessCondition
    }

    const createPostRequest = {
      profileId,
      contentURI: 'ipfs://' + contentURI.path,
      collectModule: {
        freeCollectModule: { followerOnly: true }
      },
      referenceModule: {
        followerOnlyReferenceModule: false
      },
      gated
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
      signer: getSigner(),
      env: LensEnvironment.Polygon,
    })

    let condition = {}

    if (gatingType === 'nft') {
      accessCondition.contractType = ContractType.Erc721
      condition = {
        nft: accessCondition
      }
    } else {
      accessCondition.contractType = ContractType.Erc20
      condition = {
        Erc20: accessCondition
      }
    }

    console.log({ condition })

    const { contentURI, encryptedMetadata } = await sdk.gated.encryptMetadata(
      metadata,
      profileId,
      {
       ...condition
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
  }
  function onChange(e) {
    setPostData(e.target.value)
  }

  function onSelectChange(e) {
    setChainID(e.target.value)
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
      { /* once the user has authenticated, show the the main app */ }
      {
        address && token && (
          <div className={containerStyle}>
            <div>
              <button className={buttonStyle(gatingType, 'nft')} onClick={() => setGatingType('nft')}>Gate with NFT</button>
              <button className={buttonStyle(gatingType, 'erc20')} onClick={() => setGatingType('erc20')}>Gate with ERC20 token</button>
            </div>
            {
              gatingType == 'nft' && (
                <div className={conditionContainerStyle}>
                  <p>Set NFT Gating conditions</p>
                  <input
                    placeholder='NFT Contract Address'
                    className={inputStyle}
                    onChange={e => setContractAddress(e.target.value)}
                  />
                  <GatingSelect onChange={onSelectChange} />
                </div>
              )
            }
            {
              gatingType == 'erc20' && (
                <div className={conditionContainerStyle}>
                  <p>Set ERC20 Gating conditions</p>
                  <input
                    placeholder='ERC20 Contract Address'
                    className={inputStyle}
                    onChange={e => setContractAddress(e.target.value)}
                  />
                  <GatingSelect onChange={onSelectChange} />

                </div>
              )
            }
            <textarea
              onChange={onChange}
              className={textAreaStyle}
              placeholder="Encrypted post content"
            />
            <button className={submitButtonStyle} onClick={createPost}>Submit</button>
          </div>
        )
      }
    </div>
  )
}

function GatingSelect({ onSelectChange }) {
  return (
    <select name="chains" id="chains" className={selectStyle} onChange={onSelectChange}>
      <option value="1">Etherem</option>
      <option value="137">Polygon</option>
      <option value="10">Optimism</option>
      <option value="42161">Arbitrum</option>
    </select>
  )
}

const selectStyle = css`
  padding: 6px 10px;
  border-radius: 7px;
  margin-left: 5px;
  border: 1px solid rgba(0, 0, 0, .25);
`

const containerStyle = css`
  display: flex;
  flex-direction: column;
`

const inputStyle = css`
  outline: none;
  border: 1px solid rgba(0, 0, 0, .25);
  padding: 9px 15px;
  border-radius: 25px;
`

const textAreaStyle = css`
  ${inputStyle};
  border-radius: 4px;
  min-height: 100px;
`

const conditionContainerStyle = css`
  margin: 5px 0px 20px;
`

const buttonStyle = (base, type) => {
  let color = base === type ? '#328ce5' : '#1976d2'
  return css`
  border: none;
  outline: none;
  padding: 13px 35px;
  border-radius: 35px;
  margin-right: 6px;
  cursor: pointer;
  font-weight: 800;
  color: white;
  background-color: ${color};
  text-shadow: 1px 1px 2px rgba(0, 0, 0, .2);
`
}

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