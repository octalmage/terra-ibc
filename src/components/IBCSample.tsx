import { MsgTransfer, Coin } from '@terra-money/terra.js';
import {
  CreateTxFailed,
  Timeout,
  TxFailed,
  TxResult,
  TxUnspecifiedError,
  useConnectedWallet,
  useWallet,
  UserDenied,
  useLCDClient,
} from '@terra-money/wallet-provider';
import { bech32 } from 'bech32';
import { connected } from 'process';
import { useCallback, useState, useEffect } from 'react';

export function IBCSample() {
  const { status } = useWallet();
  const [txResult, setTxResult] = useState<TxResult | null>(null);
  const [osmosisAddress, setOsmosisAddress] = useState<string | null>(null);
  const [txError, setTxError] = useState<string | null>(null);
  const [ustBalance, setUSTBalance] = useState<string>('0');
  const lcd = useLCDClient();

  const connectedWallet = useConnectedWallet();

  useEffect(() => {
    if (status !== 'WALLET_CONNECTED') {
      return;
    }

    // Convert Terra address to Osmosis.
    const hexAddr = bech32.decode(connectedWallet?.walletAddress as string);
    setOsmosisAddress(bech32.encode('osmo', hexAddr.words));

    const updateBalance = async () => {
      const [coins] = await lcd.bank.balance(connectedWallet!.walletAddress);
      const ust = coins.get('uusd')!.amount.div(1000000).toFixed(0);
      setUSTBalance(ust);
    };

    updateBalance();
  }, [connectedWallet, status, lcd, txResult]);

  const proceed = useCallback(() => {
    if (!connectedWallet) {
      return;
    }

    setTxResult(null);
    setTxError(null);

    connectedWallet
      .post({
        msgs: [
          new MsgTransfer(
            'transfer',
            'channel-22', // Osmosis outbound channel
            new Coin('uusd', '1000000'),
            connectedWallet.walletAddress,
            osmosisAddress || '',
            undefined, // Timeout block height
            (Date.now() + 60 * 1000) * 1e6 // Timeout timestamp
          ),
        ],
      })
      .then((nextTxResult: TxResult) => {
        console.log(nextTxResult);
        setTxResult(nextTxResult);
      })
      .catch((error: unknown) => {
        if (error instanceof UserDenied) {
          setTxError('User Denied');
        } else if (error instanceof CreateTxFailed) {
          setTxError('Create Tx Failed: ' + error.message);
        } else if (error instanceof TxFailed) {
          setTxError('Tx Failed: ' + error.message);
        } else if (error instanceof Timeout) {
          setTxError('Timeout');
        } else if (error instanceof TxUnspecifiedError) {
          setTxError('Unspecified Error: ' + error.message);
        } else {
          setTxError(
            'Unknown Error: ' +
              (error instanceof Error ? error.message : String(error)),
          );
        }
      });
  }, [connectedWallet, osmosisAddress]);

  return (
    <div>
      <h1>IBC Sample</h1>
      <p>UST Balance: {ustBalance}</p>
      {connectedWallet?.availablePost && !txResult && !txError && (
        <button onClick={proceed}>Send 1 UST to {osmosisAddress}</button>
      )}

      {txResult && (
        <>
          <pre>{JSON.stringify(txResult, null, 2)}</pre>

          {connectedWallet && txResult && (
            <div>
              <a
                href={`https://finder.terra.money/${connectedWallet.network.chainID}/tx/${txResult.result.txhash}`}
                target="_blank"
                rel="noreferrer"
              >
                Open Tx Result in Terra Finder
              </a>
            </div>
          )}
        </>
      )}

      {txError && <pre>{txError}</pre>}

      {(!!txResult || !!txError) && (
        <button
          onClick={() => {
            setTxResult(null);
            setTxError(null);
          }}
        >
          Clear result
        </button>
      )}

      {!connectedWallet && <p>Wallet not connected!</p>}

      {connectedWallet && !connectedWallet.availablePost && (
        <p>This connection does not support post()</p>
      )}
    </div>
  );
}
