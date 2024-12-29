const { cmd } = require('../command');
const axios = require('axios');
const fs = require('fs');
const path = require('path');
const { exec } = require('child_process');

cmd({
    pattern: "gitclone",
    alias: ['clone', 'githubclone'],
    react: '📦',
    desc: "Clone GitHub Repository",
    category: "github",
    filename: __filename
}, async (conn, mek, m, { from, reply, args, pushName }) => {
    try {
        // React to show processing
        await m.react("🔍");

        // Check if repository URL is provided
        if (!args[0]) {
            return await reply(`*🐺 GITHUB REPOSITORY CLONER*

Usage: .gitclone <github_repo_url>

Examples:
.gitclone https://github.com/username/repository
.gitclone https://github.com/darkhackersl/Thenu-MD

*Tips:*
- Use full GitHub repository URL
- Ensure repository is public
- No private repositories`);
        }

        // Validate GitHub URL
        const repoUrl = args[0];
        const githubRegex = /^(https?:\/\/)?(www\.)?github\.com\/[a-zA-Z0-9-]+\/[a-zA-Z0-9-]+(\/(tree\/[a-zA-Z0-9-]+)?)?$/;
        
        if (!githubRegex.test(repoUrl)) {
            return await reply("❌ Invalid GitHub Repository URL");
        }

        // Send processing message
        const processingMsg = await reply(`🔄 *Cloning Repository:*\n${repoUrl}\n\n⏳ Initializing...`);

        // Generate unique folder name
        const folderName = `clone_${Date.now()}`;
        const clonePath = path.join(process.cwd(), 'downloads', folderName);

        // Ensure downloads directory exists
        if (!fs.existsSync(path.join(process.cwd(), 'downloads'))) {
            fs.mkdirSync(path.join(process.cwd(), 'downloads'), { recursive: true });
        }

        // Clone repository
        const cloneCommand = `git clone --depth 1 ${repoUrl} ${clonePath}`;

        // Execute clone command
        exec(cloneCommand, async (error, stdout, stderr) => {
            // Delete processing message
            try {
                await conn.sendMessage(from, { delete: processingMsg.key });
            } catch {}

            if (error) {
                console.error("Clone Error:", error);
                await reply(`❌ Cloning Failed:\n${error.message}`);
                await m.react("❌");
                return;
            }

            try {
                // Fetch repository information
                const repoInfo = await getRepositoryInfo(repoUrl);

                // Create ZIP of the repository
                const zipFileName = `${folderName}.zip`;
                const zipPath = path.join(process.cwd(), 'downloads', zipFileName);
                
                // Compress repository
                const compressCommand = `cd downloads && zip -r ${zipFileName} ${folderName}`;
                
                exec(compressCommand, async (zipError) => {
                    if (zipError) {
                        console.error("Zip Error:", zipError);
                        await reply(`❌ Failed to compress repository`);
                        return;
                    }

                    // Read file buffer
                    const fileBuffer = fs.readFileSync(zipPath);

                    // Prepare repository details message
                    const repoDetailsMessage = `📦 *Repository Cloned Successfully!*

🔗 URL: ${repoUrl}
📁 Folder: ${folderName}
⭐ Stars: ${repoInfo.stars}
🍴 Forks: ${repoInfo.forks}
👤 Owner: ${repoInfo.owner}

*Repository Size:* ${getFileSizeInMB(zipPath)} MB`;

                    // Send repository ZIP
                    await conn.sendMessage(from, {
                        document: fileBuffer,
                        fileName: Thenux,
                        mimetype: 'application/zip',
                        caption: repoDetailsMessage
                    });

                    // React with success
                    await m.react("✅");

                    // Clean up temporary files
                    setTimeout(() => {
                        try {
                            fs.unlinkSync(zipPath);
                            fs.rmSync(clonePath, { recursive: true, force: true });
                        } catch (cleanupError) {
                            console.error("Cleanup Error:", cleanupError);
                        }
                    }, 5 * 60 * 1000); // 5 minutes
                });

            } catch (infoError) {
                console.error("Repository Info Error:", infoError);
                await reply(`❌ Cloned Successfully, but failed to fetch additional details.`);
                await m.react("❌");
            }
        });

    } catch (mainError) {
        console.error("Git Clone Command Error:", mainError);
        await reply("An unexpected error occurred during repository cloning.");
        await m.react("❌");
    }
});

// Helper function to get repository information
async function getRepositoryInfo(repoUrl) {
    try {
        // Extract username and repository name
        const match = repoUrl.match(/github\.com\/([^\/]+)\/([^\/]+)/);
        if (!match) throw new Error("Invalid repository URL");

        const [, username, repo] = match;

        // Fetch repository details from GitHub API
        const response = await axios.get(`https://api.github.com/repos/${username}/${repo}`);
        
        return {
            stars: response.data.stargazers_count,
            forks: response.data.forks_count,
            owner: response.data.owner.login
        };
    } catch (error) {
        console.error("GitHub API Error:", error);
        return {
            stars: "N/A",
            forks: "N/A",
            owner: "Unknown"
        };
    }
}

// Helper function to get file size in MB
function getFileSizeInMB(filePath) {
    try {
        const stats = fs.statSync(filePath);
        return (stats.size / (1024 * 1024)).toFixed(2);
    } catch (error) {
        return "N/A";
    }
}

// Bonus: GitHub Repository Search Command
cmd({
    pattern: "githubsearch",
    alias: ['searchrepo', 'findrepo'],
    react: '🔍',
    desc: "Search GitHub Repositories",
    category: "github"
}, async (conn, mek, m, { args, reply }) => {
    try {
        // Check if search query is provided
        if (!args[0]) {
            return await reply("Please provide a search query for GitHub repositories");
        }

        const query = args.join(" ");

        // Search repositories
        const response = await axios.get('https://api.github.com/search/repositories', {
            params: {
                q: query,
                sort: 'stars',
                order: 'desc',
                per_page: 5
            }
        });

        // Prepare search results
        const results = response.data.items.map((repo, index) => `
*${index + 1}. ${repo.full_name}*
🌟 Stars: ${repo.stargazers_count}
📄 Description: ${repo.description || 'No description'}
🔗 URL: ${repo.html_url}
`).join('\n\n');

        // Send search results
        await reply(`*🔍 GitHub Repository Search Results*\n\n${results}`);

    } catch (error) {
        console.error("GitHub Search Error:", error);
        await reply("Failed to search GitHub repositories");
    }
});
