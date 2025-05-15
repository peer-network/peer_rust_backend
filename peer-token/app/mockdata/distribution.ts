import { randomUUID } from "crypto";


export interface TokenDistribution {
    data: {
        GetGemsForDay: {
            status: string;
            ResponseCode: string;
            Date: string;
            affectedRows: {
                data: Array<{
                    userId: string;
                    walletAddress: string;
                    tokens: number;
                }>;
                totalTokens: number;
            };
        };
    };
};

export const tokenDistribution: TokenDistribution = {
    data: {
      GetGemsForDay: {
        status: "success",
        ResponseCode: "200",
        Date: "2025-04-26",
        affectedRows: {
          data: [
            {
              userId: randomUUID(),
              walletAddress: "GoGELpnDCUo3XtiHT8nc2L5k8JP1uTmpS14Q6tTsc3Jc",
              tokens: 3,
            },
            {
              userId: randomUUID(),
              walletAddress: "F2cYZUCWFECQuXtrB8m7qhnekg5LfP2Gj4tANv7uND1H",
              tokens: 3,
            },
            {
              userId: randomUUID(),
              walletAddress: "27AiRNWETjdJxKkNw7GfHQKFv1uGfsbAmqGKehjJ7m4E",
              tokens: 0.25,
            },
            {
              userId: randomUUID(),
              walletAddress: "8tRMVrjgyCQdao7SHQbJRELwWKEGnyoc8wQy46p2tZA6",
              tokens: 3,
            },
            {
              userId: randomUUID(),
              walletAddress: "39SPpcRb5tyjgsTTPtPdoL1VDfjxGBemwuvdXtjBUapi",
              tokens: 0.25,
            },
            {
              userId: randomUUID(),
              walletAddress: "BE6KqwpWE5M6WvAB9N3cJsgU24g1cHkoCFR7b54oCpdX",
              tokens: 3,
            },
            {
              userId: randomUUID(),
              walletAddress: "DKxAU3wucNrmN4yZ4kdSS9P7rPFub4XR7bEPHJThdqe9",
              tokens: 0.25,
            },
            {
              userId: randomUUID(),
              walletAddress: "CiLgfHxA9vwVbbvhBp7YMrpb8e5XTmej76AyzeCZxy6h",
              tokens: 3,
            },
            {
              userId: randomUUID(),
              walletAddress: "Chx6VCt22uKZhLJmndwBNQmNxYsCHnQzBKM8cim8DTQE",
              tokens: 3,
            },
            {
              userId: randomUUID(),
              walletAddress: "3HzwqASJpNb1sH618URMMJVLArrGmNxAUyYi28SriJw6",
              tokens: 0.25,
            },
            {
              userId: randomUUID(),
              walletAddress: "BoSneAsUYtLLW5bLuTRqWtRUvjQWMefeMni6rYH93vvn",
              tokens: 0.25,
            },
            {
              userId: randomUUID(),
              walletAddress: "BX1gA9vkSVgUgduohvQuiXRVo45fLZSWdPoHj6y4g5aa",
              tokens: 3,
            },
            {
              userId: randomUUID(),
              walletAddress: "6Fz3dARv6SYZpy7A5UAzfDugiKVCb1aqQcuzegY1KTpX",
              tokens: 0.25,
            },
            {
              userId: randomUUID(),
              walletAddress: "A22RVCBuutnkH4BjGScPbF63XkyPLBzRASdhCC1gpQAL",
              tokens: 0.25,
            },
            {
              userId: randomUUID(),
              walletAddress: "AAgmgPLacHP9Q86yXANrkqck7Cb48kJLYngwfe5xkgUd",
              tokens: 3,
            },
            {
              userId: randomUUID(),
              walletAddress: "3v8mbAhFo65LDj6TikbDzJkaVpWvK9utgC6mRmXAgeri",
              tokens: 0.25,
            },
            {
              userId: randomUUID(),
              walletAddress: "wm49jgV8CcPTtFkUNcTy52evCaYVzwFFZdK9FiPckvu",
              tokens: 3,
            },
            {
              userId: randomUUID(),
              walletAddress: "F7zGAqsnb7PfxRc1ZGTbYMXdnVqH3cX3qKAgtdLZeHDw",
              tokens: 0.25,
            }
          ],
          totalTokens: 26.5
        }
      }
    }
  }
  