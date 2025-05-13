import * as fs from 'fs';
import * as path from 'path';

interface GemUser {
    userId: string;
    walletAddress: string;
    gems: string;
}

interface TokenDistribution {
    userId: string;
    walletAddress: string;
    gems: number;
    tokens: number;
}

interface TokenDistributionOutput {
    tokenDistribution: {
        date: string;
        totalTokens: number;
        distributions: TokenDistribution[];
        summary: {
            totalGems: number;
            totalTokensDistributed: number;
        };
    };
}

const TOTAL_TOKENS_TO_DISTRIBUTE = 5000;

function calculateTokenDistribution(): void {
    try {
        // Read the Gemdata.json file
        const gemdataPath = path.join(__dirname, 'data', 'Gemdata.json');
        const rawData = fs.readFileSync(gemdataPath, 'utf8');
        const gemData = JSON.parse(rawData);

        // Extract relevant data
        const date = gemData.data.GetGemsForDay.Date;
        const totalGems = parseInt(gemData.data.GetGemsForDay.affectedRows.data[0].totalGems);
        const users = gemData.data.GetGemsForDay.affectedRows.data.slice(1);

        // Calculate token distribution
        const distributions: TokenDistribution[] = users.map((user: GemUser) => {
            const userGems = parseInt(user.gems);
            const tokens = Math.floor((userGems / totalGems) * TOTAL_TOKENS_TO_DISTRIBUTE);
            
            return {
                userId: user.userId,
                walletAddress: user.walletAddress,
                gems: userGems,
                tokens: tokens
            };
        });

        // Create output object
        const output: TokenDistributionOutput = {
            tokenDistribution: {
                date: date,
                totalTokens: TOTAL_TOKENS_TO_DISTRIBUTE,
                distributions: distributions,
                summary: {
                    totalGems: totalGems,
                    totalTokensDistributed: distributions.reduce((sum, dist) => sum + dist.tokens, 0)
                }
            }
        };

        // Write to TokenDistribution.json
        const outputPath = path.join(__dirname, 'data', 'TokenDistribution.json');
        fs.writeFileSync(outputPath, JSON.stringify(output, null, 2));
        
        console.log('Token distribution calculation completed successfully!');
        console.log(`Total users processed: ${distributions.length}`);
        console.log(`Total tokens distributed: ${output.tokenDistribution.summary.totalTokensDistributed}`);
    } catch (error) {
        console.error('Error calculating token distribution:', error);
        process.exit(1);
    }
}

// Run the calculation
calculateTokenDistribution();
