/**
 * The "out of tree" counterpoint — CONSOLE ONLY.
 *
 * The on-screen story now lives in the in-editor panel (src/store-consumer.js).
 * This plain, un-built script stays as a small aside for anyone who opens the
 * console: it reads the SAME store from OUTSIDE the editor's React tree, first
 * at load (the hydration race) and then via a hand-rolled subscribe().
 *
 * `subscribe()` is reactive, but you wire up the diffing and there's no
 * automatic teardown — contrast that with the panel's one-line `useSelect`.
 */
( function ( wp ) {
	'use strict';

	const { select, subscribe } = wp.data;
	const STORE = 'core/block-editor';
	const read = () => select( STORE ).getBlockCount();

	// Variant A: read at script load — usually 0, because the editor has not
	// hydrated the post's blocks yet. This is the same race the panel's
	// "Captured at load" row shows on screen.
	console.log(
		'[store-demo] A · read at load →',
		read(),
		'(often 0 — editor not hydrated yet)'
	);

	// Variant C: subscribe() out of tree — reactive, but hand-wired. Logs in the
	// same shape as the panel's live row, so console and panel tick together.
	let last;
	subscribe( function () {
		const count = read();
		if ( count !== last ) {
			last = count;
			console.log(
				'[store-demo] blockCount = ' +
					count +
					'  · via subscribe() (global, out of tree)'
			);
		}
	} );
} )( window.wp );
