# Diário do Professor

Aplicativo desktop Windows feito com Electron, Vite, React e Tailwind CSS.

## Fluxo recomendado

Use uma cópia local do repositório. Depois da primeira vez, você só precisa entrar na pasta e atualizar com `git pull`.

```sh
git clone https://github.com/IsaacJGF/class-notes-hub.git
cd class-notes-hub
npm install
```

Para atualizar sua cópia local:

```sh
git pull
npm install
```

## Rodar em desenvolvimento

```sh
npm run dev
```

## Criar instalador Windows

```sh
npm run release:win
```

O instalador será gerado na pasta `release`.

## Versionar o app

Use um dos comandos abaixo antes de gerar uma nova versão:

```sh
npm run version:patch
npm run version:minor
npm run version:major
```

Exemplo para subir de `1.0.0` para `1.0.1`:

```sh
npm run version:patch
npm run release:win
```

## Publicar atualização automática

O app está configurado para buscar atualizações nos releases do GitHub.

Para publicar uma nova versão:

```sh
npm run version:patch
npm run publish:win
```

Esse comando gera o instalador e publica os arquivos necessários para o atualizador automático. Para publicar no GitHub, a máquina precisa estar autenticada com permissão de escrita no repositório.

No Windows PowerShell, configure um token do GitHub com permissão para publicar releases antes de rodar o comando:

```sh
$env:GH_TOKEN="seu_token_do_github"
npm run publish:patch:win
```

O comando `publish:patch:win` aumenta a versão automaticamente, por exemplo de `1.0.0` para `1.0.1`, gera o instalador e publica a atualização.

## Atualização automática

Quando o app estiver instalado e uma nova versão for publicada nos releases do GitHub, ele verifica atualizações ao abrir. Se houver uma versão nova, baixa automaticamente e pede para reiniciar o aplicativo.

Observação: quem instalou uma versão antiga que ainda não tinha atualização automática precisa instalar manualmente a primeira versão com esse recurso. Depois disso, as próximas versões chegam pelo próprio aplicativo.

---

# Lovable project

## Project info

**URL**: https://lovable.dev/projects/b64f8d99-9957-4bf3-b2a8-61c816a4deff?view=codeEditor

## How can I edit this code?

There are several ways of editing your application.

**Use Lovable**

Simply visit the [Lovable Project](https://lovable.dev/projects/b64f8d99-9957-4bf3-b2a8-61c816a4deff?view=codeEditor) and start prompting.

Changes made via Lovable will be committed automatically to this repo.

**Use your preferred IDE**

If you want to work locally using your own IDE, you can clone this repo and push changes. Pushed changes will also be reflected in Lovable.

The only requirement is having Node.js & npm installed - [install with nvm](https://github.com/nvm-sh/nvm#installing-and-updating)

Follow these steps:

```sh
# Step 1: Clone the repository using the project's Git URL.
git clone <YOUR_GIT_URL>

# Step 2: Navigate to the project directory.
cd <YOUR_PROJECT_NAME>

# Step 3: Install the necessary dependencies.
npm i

# Step 4: Start the development server with auto-reloading and an instant preview.
npm run dev
```

**Edit a file directly in GitHub**

- Navigate to the desired file(s).
- Click the "Edit" button (pencil icon) at the top right of the file view.
- Make your changes and commit the changes.

**Use GitHub Codespaces**

- Navigate to the main page of your repository.
- Click on the "Code" button (green button) near the top right.
- Select the "Codespaces" tab.
- Click on "New codespace" to launch a new Codespace environment.
- Edit files directly within the Codespace and commit and push your changes once you're done.

## What technologies are used for this project?

This project is built with:

- Vite
- TypeScript
- React
- shadcn-ui
- Tailwind CSS

## How can I deploy this project?

Simply open [Lovable](https://lovable.dev/projects/b64f8d99-9957-4bf3-b2a8-61c816a4deff?view=codeEditor) and click on Share -> Publish.

## Can I connect a custom domain to my Lovable project?

Yes, you can!

To connect a domain, navigate to Project > Settings > Domains and click Connect Domain.

Read more here: [Setting up a custom domain](https://docs.lovable.dev/features/custom-domain#custom-domain)
