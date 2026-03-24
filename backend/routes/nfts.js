const router = require("express").Router();

const CATEGORY_NAMES = ["TICKET", "EXPERIENCE", "COLLECTIBLE", "BADGE", "MERCHANDISE"];
const STATUS_NAMES = ["VALID", "USED", "EXPIRED", "CANCELLED"];

router.get("/verify/:tokenId", async (req, res) => {
  try {
    const { contracts } = req.app.locals;
    const tokenId = req.params.tokenId;
    const authentic = await contracts.wireTrustNFT.isAuthentic(tokenId);

    res.json({
      tokenId,
      authentic,
    });
  } catch (err) {
    console.error("Verify NFT failed:", err.message);
    res.status(500).json({ error: "Failed to verify NFT", details: err.message });
  }
});

router.get("/owned/:address", async (req, res) => {
  try {
    const { contracts } = req.app.locals;
    const address = req.params.address;
    const totalSupply = await contracts.wireTrustNFT.tokenCount();
    const total = Number(totalSupply);
    const owned = [];

    const cap = Math.min(total, 100);
    const start = total > cap ? total - cap + 1 : 1;

    for (let i = start; i <= total; i++) {
      try {
        const owner = await contracts.wireTrustNFT.ownerOf(i);
        if (owner.toLowerCase() === address.toLowerCase()) {
          owned.push(i);
        }
      } catch {
        // Token may not exist or was burned
      }
    }

    res.json({
      address,
      count: owned.length,
      tokenIds: owned,
    });
  } catch (err) {
    console.error("Get owned NFTs failed:", err.message);
    res.status(500).json({ error: "Failed to get owned NFTs", details: err.message });
  }
});

router.get("/:tokenId", async (req, res) => {
  try {
    const { contracts } = req.app.locals;
    const tokenId = req.params.tokenId;
    const metadata = await contracts.wireTrustNFT.getFullMetadata(tokenId);
    const owner = await contracts.wireTrustNFT.ownerOf(tokenId);

    const categoryIndex = Number(metadata.category);
    const statusIndex = Number(metadata.status);

    res.json({
      tokenId: metadata.tokenId.toString(),
      franchiseId: metadata.franchiseId.toString(),
      category: categoryIndex,
      categoryName: CATEGORY_NAMES[categoryIndex] || "UNKNOWN",
      name: metadata.name,
      description: metadata.description,
      metadataURI: metadata.metadataURI,
      facePrice: metadata.facePrice.toString(),
      maxResalePrice: metadata.maxResalePrice.toString(),
      maxTransfers: Number(metadata.maxTransfers),
      transferCount: Number(metadata.transferCount),
      eventTimestamp: metadata.eventTimestamp.toString(),
      mintedAt: metadata.mintedAt.toString(),
      status: statusIndex,
      statusName: STATUS_NAMES[statusIndex] || "UNKNOWN",
      soulbound: metadata.soulbound,
      owner,
    });
  } catch (err) {
    console.error("Get NFT failed:", err.message);
    res.status(500).json({ error: "Failed to get NFT", details: err.message });
  }
});

module.exports = router;
