<?php
/**
 * Plugin Name:       Editor Store Access Demo
 * Description:        Demonstrates the difference between reading the block editor data store imperatively via the wp.data global (snapshot / hydration / staleness) versus subscribing to it correctly from inside the editor's React tree.
 * Version:           0.1.0
 * Requires at least: 6.5
 * Requires PHP:      7.4
 * Author:            Ryan Welcher
 * License:           GPL-2.0-or-later
 * Text Domain:       editor-store-access-demo
 *
 * @package EditorStoreAccessDemo
 */

if ( ! defined( 'ABSPATH' ) ) {
	exit;
}

/**
 * Enqueue the two demo scripts on the block editor.
 *
 * Script 1 (global-reads.js) is plain, un-built JavaScript that reads the
 * store imperatively through the `wp.data` global. It depends only on
 * `wp-data`, so it needs no build step.
 *
 * Script 2 (store-consumer.js) is built with @wordpress/scripts. It registers
 * a plugin whose component lives inside the editor's React tree and subscribes
 * to the store via `useSelect`.
 */
function esad_enqueue_block_editor_assets() {
	$plugin_dir = plugin_dir_path( __FILE__ );
	$plugin_url = plugin_dir_url( __FILE__ );

	// --- Script 1: imperative reads through the wp.data global. ---
	$global_reads_path = $plugin_dir . 'assets/global-reads.js';
	wp_enqueue_script(
		'esad-global-reads',
		$plugin_url . 'assets/global-reads.js',
		array( 'wp-data' ),
		file_exists( $global_reads_path ) ? filemtime( $global_reads_path ) : '0.1.0',
		true
	);

	// --- Script 2: a store consumer rendered inside the editor tree. ---
	$asset_file = $plugin_dir . 'build/store-consumer.asset.php';
	if ( file_exists( $asset_file ) ) {
		$asset = require $asset_file;
		wp_enqueue_script(
			'esad-store-consumer',
			$plugin_url . 'build/store-consumer.js',
			$asset['dependencies'],
			$asset['version'],
			true
		);
	}
}
add_action( 'enqueue_block_editor_assets', 'esad_enqueue_block_editor_assets' );
