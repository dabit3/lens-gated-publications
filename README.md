## Token Gating app on Lens

This is an example project showing how to implement token gated posts on Lens, and also showing how to decrypt token gated posts on Lens.

### Project setup

To run this project follow these steps

1. Clone the project:

```sh
git clone git@github.com:dabit3/lens-token-gating.git
```

2. Install the dependencies

```sh
npm install

# or yarn, pnpm, etc...
```

3. Configure the environment variables.   
 
Update `.example.env.local` to `.env.local` and configure the `NEXT_PUBLIC_PROJECT_ID` and `NEXT_PUBLIC_PROJECT_SECRET` with your Infura project information.

Also optionally configure the `NEXT_PUBLIC_ENVIRONMENT` with the network you'd like to connect to.

1. Run the app

```sh
npm run dev
```