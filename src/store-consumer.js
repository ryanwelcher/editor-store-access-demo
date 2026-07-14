/**
 * ONE persistent, self-updating notice at the top of the editor that puts the
 * ways of reading the store side by side and keeps them live as you edit.
 *
 * Same value (the post's block count), read four ways — three via the wp.data
 * global (each with a catch), and the one correct path via useSelect:
 *
 *   A · read at load       — ❌ select() reads 0, before hydration. Wrong data.
 *   B · snapshot reused     — ❌ a select() snapshot goes stale. Wrong data.
 *   C · subscribe()         — ⚠️ live + correct, BUT you hand-wire the diffing
 *                              and the cleanup, outside React. Right data, wrong way.
 *   ✅ useSelect()          — right data, the right way: reactive, managed, in-tree.
 *
 * A/B stay frozen (flagged "stale"); C and useSelect tick together on every
 * edit. The notice is re-dispatched with the SAME id on each change, so it
 * updates in place instead of stacking.
 */
import { registerPlugin } from '@wordpress/plugins';
import { useSelect, useDispatch, select, subscribe } from '@wordpress/data';
import { store as blockEditorStore } from '@wordpress/block-editor';
import { store as noticesStore } from '@wordpress/notices';
import { Modal } from '@wordpress/components';
import { useEffect, useRef, useState } from '@wordpress/element';

const NOTICE_ID = 'esad-store-comparison';

// ❌ Variant A: read ONCE at module load — before the editor hydrates the post.
// Frozen forever at whatever it was then (usually 0).
const capturedAtLoad = select( blockEditorStore ).getBlockCount();

// Build the notice body as a full-width comparison grid (rendered via
// __unstableHTML). CSS grid with fr columns so it stretches to fill the notice.
//
// Accessibility: meaning is NOT carried by colour alone. Every value cell shows
// a word + shape status pill (✗ STALE / ✓ LIVE / ✓ LIVE·MANUAL) that reads the
// same in greyscale, and the correct column is marked structurally with a tint
// and a left border. Colour (blue vs rust/orange, distinguishable across common
// colour-vision types) is only reinforcement.
function buildNoticeHTML( live, atLoad, snapshot, subscribed ) {
	const BLUE = '#0b5cad'; // correct / live-managed
	const RUST = '#8a1500'; // stale / wrong
	const OCHRE = '#8a5a00'; // live, but hand-wired
	const rowBorder = 'border-top:1px solid #d9d4b8;';
	const goodBg = 'background:rgba(11,92,173,0.06);border-left:3px solid ' + BLUE + ';';

	// Word + shape status pill — the primary, colour-independent signal.
	const pill = ( symbol, word, color ) =>
		`<span style="display:inline-block;font-size:10px;font-weight:800;letter-spacing:.05em;padding:1px 7px;border:1.5px solid ${ color };border-radius:11px;color:${ color };margin-left:8px;white-space:nowrap;vertical-align:middle;">${ symbol } ${ word }</span>`;

	const caption = ( text ) =>
		`<div style="font-size:11px;color:#555;margin-top:4px;">${ text }</div>`;

	const number = ( value, color, pillHTML ) =>
		`<span style="font-size:22px;font-weight:800;color:${ color };font-variant-numeric:tabular-nums;vertical-align:middle;">${ value }</span>${ pillHTML }`;

	const headCell = ( text, extra = '' ) =>
		`<div style="padding:4px 14px;font-size:12px;font-weight:700;color:#333;${ extra }">${ text }</div>`;

	const labelCell = ( text ) =>
		`<div style="padding:10px 14px;font-size:12px;display:flex;align-items:center;${ rowBorder }">${ text }</div>`;

	const globalCell = ( value, isStale, cap ) =>
		`<div style="padding:10px 14px;${ rowBorder }">${ number(
			value,
			isStale ? RUST : '#1e1e1e',
			isStale ? pill( '✗', 'STALE', RUST ) : pill( '✓', 'OK', BLUE )
		) }${ caption( cap ) }</div>`;

	const manualCell = ( value, cap ) =>
		`<div style="padding:10px 14px;${ rowBorder }">${ number(
			value,
			OCHRE,
			pill( '✓', 'LIVE · MANUAL', OCHRE )
		) }${ caption( cap ) }</div>`;

	const goodCell = ( cap ) =>
		`<div style="padding:10px 14px;${ rowBorder }${ goodBg }">${ number(
			live,
			BLUE,
			pill( '✓', 'LIVE', BLUE )
		) }${ caption( cap ) }</div>`;

	return `<div style="width:100%;box-sizing:border-box;font:13px/1.4 -apple-system,system-ui,sans-serif;">
		<strong>Block-editor store · the same value, read different ways</strong>
		<div style="display:grid;grid-template-columns:minmax(190px,1.4fr) 1fr 1fr;width:100%;margin-top:6px;">
			${ headCell( '' ) }
			${ headCell( '<code>wp.data.select()</code> / <code>.subscribe()</code><div style="font-weight:400;color:#555;font-size:11px;margin-top:1px;">global object · imperative</div>' ) }
			${ headCell( '✓ <code>useSelect()</code> hook<div style="font-weight:400;color:#555;font-size:11px;margin-top:1px;">React · subscribed</div>', goodBg + 'color:' + BLUE + ';' ) }

			${ labelCell( 'A · read at load' ) }
			${ globalCell( atLoad, atLoad !== live, 'read once, before hydration — stays empty' ) }
			${ goodCell( 'starts empty too — then re-renders itself automatically once hydrated' ) }

			${ labelCell( 'B · read on demand' ) }
			${ globalCell( snapshot, snapshot !== live, 'a snapshot — stale until you re-read' ) }
			${ goodCell( 're-reads automatically on every change' ) }

			${ labelCell( 'C · subscribe() for updates' ) }
			${ manualCell( subscribed, 'live, but you wire the diffing + cleanup, out of tree' ) }
			${ goodCell( 'same result — but automatic, no wiring or cleanup' ) }
		</div>
	</div>`;
}

// Static code for the "Show the code" modal. Never changes as you edit, so it
// lives in a persistent React surface (not in the re-rendered notice).
const SNIPPETS = [
	{
		id: 'A',
		title: 'A · read at load',
		kind: 'bad',
		note: 'Reads once on domReady — before hydration — and never runs again.',
		code: `// This callback runs ONE time, as the script loads.
wp.domReady( () => {
    const count = wp.data
        .select( 'core/block-editor' )
        .getBlockCount();

    // → 0. domReady fires before the editor hydrates the
    //   post's blocks, and this never runs again.
    console.log( count );
} );`,
	},
	{
		id: 'B',
		title: 'B · snapshot, read on demand',
		kind: 'bad',
		note: 'select() gives the value right now — but only when you ask. You must re-read by hand every time.',
		code: `// select() gives a SNAPSHOT of the count right now.
let count = wp.data
    .select( 'core/block-editor' )
    .getBlockCount();

// Reuse it later and it's stale — it never re-reads itself.
// You CAN get the current value, but only by asking again
//   by hand — e.g. on every button click:
refreshButton.addEventListener( 'click', () => {
    count = wp.data
        .select( 'core/block-editor' )
        .getBlockCount();   // current only at click time
    console.log( count );
} );`,
	},
	{
		id: 'C',
		title: 'C · subscribe() for updates',
		kind: 'manual',
		note: 'Reactive, but you write the diffing and the cleanup yourself.',
		code: `// Reactive — but you wire everything yourself.
let last;
const unsubscribe = wp.data.subscribe( () => {
    const count = wp.data
        .select( 'core/block-editor' )
        .getBlockCount();
    if ( count !== last ) {   // manual diffing
        last = count;
        console.log( count );
    }
} );

// ...and you must remember to call unsubscribe().`,
	},
	{
		id: 'useSelect',
		title: 'useSelect() hook',
		kind: 'good',
		note: 'Subscribed for you: re-renders on every change, hydration-safe, auto cleanup.',
		code: `// One call does it all.
const count = useSelect(
    ( select ) =>
        select( 'core/block-editor' ).getBlockCount(),
    []
);`,
	},
];

// Colour-independent status: a word + shape tag plus an accent border.
const KIND = {
	bad: { accent: '#8a1500', tag: '✗ AVOID' },
	manual: { accent: '#8a5a00', tag: '⚠ MANUAL' },
	good: { accent: '#0b5cad', tag: '✓ USE THIS' },
};

function CodeBlock( { snippet } ) {
	const { accent, tag } = KIND[ snippet.kind ];
	return (
		<div style={ { margin: '0 0 18px', borderLeft: `3px solid ${ accent }`, paddingLeft: 14 } }>
			<div style={ { display: 'flex', alignItems: 'center', gap: 8 } }>
				<strong>{ snippet.title }</strong>
				<span
					style={ {
						fontSize: 10,
						fontWeight: 800,
						letterSpacing: '.05em',
						color: accent,
						border: `1.5px solid ${ accent }`,
						borderRadius: 11,
						padding: '1px 7px',
						whiteSpace: 'nowrap',
					} }
				>
					{ tag }
				</span>
			</div>
			<div style={ { fontSize: 12, color: '#555', margin: '4px 0 6px' } }>
				{ snippet.note }
			</div>
			<pre
				style={ {
					margin: 0,
					padding: '14px 16px',
					background: '#1e1e1e',
					border: '1px solid #3a3a3a',
					borderRadius: 6,
					fontFamily:
						"ui-monospace, SFMono-Regular, 'SF Mono', Menlo, Consolas, 'Liberation Mono', monospace",
					fontSize: 13,
					lineHeight: 1.65,
					tabSize: 4,
					color: '#e6e6e6',
					overflowX: 'auto',
				} }
			>
				{ snippet.code.split( '\n' ).map( ( line, i ) => (
					<span
						key={ i }
						style={ {
							display: 'block',
							whiteSpace: 'pre',
							color: line.trim().startsWith( '//' )
								? '#8b949e'
								: '#e6e6e6',
						} }
					>
						{ line || ' ' }
					</span>
				) ) }
			</pre>
		</div>
	);
}

function StoreComparisonNotice() {
	// ✅ The correct path: subscribed from inside the editor tree, managed for us.
	const live = useSelect(
		( s ) => s( blockEditorStore ).getBlockCount(),
		[]
	);

	const { createNotice } = useDispatch( noticesStore );

	// The code modal's open state lives here in React, so it survives the notice
	// re-rendering on every edit.
	const [ showCode, setShowCode ] = useState( false );

	// ❌ Variant B: freeze the first real (hydrated) value we see, then reuse it
	// forever. A snapshot taken at a perfectly valid moment that still goes
	// stale the instant you edit — select() is a snapshot, not a subscription.
	const snapshotRef = useRef( null );
	if ( snapshotRef.current === null && live > 0 ) {
		snapshotRef.current = live;
	}
	const capturedSnapshot = snapshotRef.current === null ? live : snapshotRef.current;

	// ⚠️ Variant C: reactive via a hand-rolled subscribe() — note everything you
	// have to write yourself that useSelect would do for you: the imperative
	// re-read, the manual change diffing, and the teardown on unmount.
	const [ subscribed, setSubscribed ] = useState( capturedAtLoad );
	useEffect( () => {
		let last;
		const unsubscribe = subscribe( () => {
			const count = select( blockEditorStore ).getBlockCount();
			if ( count !== last ) {
				last = count;
				setSubscribed( count );
			}
		} );
		return unsubscribe; // you have to remember this cleanup yourself
	}, [] );

	// Re-dispatch with the SAME id on every change → the notice updates in place.
	useEffect( () => {
		createNotice(
			'warning',
			buildNoticeHTML( live, capturedAtLoad, capturedSnapshot, subscribed ),
			{
				id: NOTICE_ID,
				isDismissible: false,
				__unstableHTML: true,
				actions: [
					{
						label: 'Show the code',
						onClick: () => setShowCode( true ),
						variant: 'link',
					},
				],
			}
		);
	}, [ live, capturedSnapshot, subscribed, createNotice ] );

	if ( ! showCode ) {
		return null;
	}

	return (
		<Modal
			title="Reading the block-editor store — the code"
			onRequestClose={ () => setShowCode( false ) }
			style={ { maxWidth: '640px' } }
		>
			<p style={ { marginTop: 0, fontSize: 13, color: '#444' } }>
				All four read the <strong>same</strong> store. The difference is
				the method — and whether it stays in sync on its own.
			</p>
			{ SNIPPETS.map( ( snippet ) => (
				<CodeBlock key={ snippet.id } snippet={ snippet } />
			) ) }
		</Modal>
	);
}

registerPlugin( 'editor-store-access-demo', {
	render: StoreComparisonNotice,
} );
